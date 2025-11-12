import express from "express";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Lazy Stripe init to allow running without keys in dev/demo
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" } as any);
}

router.post("/create-checkout-session", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const {
      orderId,
      orderData,
      items,
      successUrl,
      cancelUrl,
      selectedShippingRate,
    } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    // Convert items to Stripe line items
    const line_items = items.map((it: any) => ({
      price_data: {
        currency: "usd",
        product_data: { name: String(it.productName || it.name || "Item") },
        unit_amount: Math.max(0, Math.round(Number(it.price || 0) * 100)),
      },
      quantity: Math.max(1, Number(it.quantity || 1)),
    }));

    // Store minimal data in Stripe metadata - NO pending orders created
    const metadata: any = {};

    if (orderId) {
      // Existing order (retry payment) - verify it exists
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      metadata.orderId = String(orderId);
    } else if (orderData) {
      // New order - store only essential data in metadata
      // Product IDs in compact format: "pid1:qty1,pid2:qty2"
      const productItems = orderData.orderItems || [];
      const productIds = productItems
        .map(
          (item: any) =>
            `${item.productId || item.pid}:${item.quantity || 1}:${Number(
              item.price || 0
            ).toFixed(2)}`
        )
        .join(",");

      // Store in metadata (will be used to create order in webhook)
      if (orderData.userId) {
        metadata.userId = String(orderData.userId);
      }
      if (orderData.shippingAddress?.email) {
        metadata.guestEmail = String(orderData.shippingAddress.email);
      }
      metadata.products = productIds.substring(0, 400); // Limit to 400 chars to stay under 500 total

      // Store shipping rate info if provided
      if (selectedShippingRate) {
        metadata.shippingRateId = selectedShippingRate.objectId;
        metadata.shippingCarrier = selectedShippingRate.carrier;
        metadata.shippingAmount = String(selectedShippingRate.amount);
        metadata.shippingService = selectedShippingRate.serviceName;
      }

      // Store notes if provided (truncated if needed)
      if (orderData.orderNotes) {
        metadata.notes = String(orderData.orderNotes).substring(0, 50);
      }

      // Store pre-collected shipping address (minimal fields)
      if (orderData.shippingAddress) {
        const addr = orderData.shippingAddress;
        metadata.addrName = addr.name?.substring(0, 50) || "";
        metadata.addrStreet = addr.street?.substring(0, 50) || "";
        metadata.addrCity = addr.city?.substring(0, 30) || "";
        metadata.addrState = addr.state?.substring(0, 20) || "";
        metadata.addrZip = addr.zipCode?.substring(0, 10) || "";
        metadata.addrCountry = addr.country?.substring(0, 10) || "";
        if (addr.phone) {
          metadata.addrPhone = addr.phone.substring(0, 20);
        }
      }
    } else {
      return res
        .status(400)
        .json({ message: "Either orderId or orderData must be provided" });
    }

    // Check if shipping address is provided
    const hasPreCollectedAddress = orderData?.shippingAddress?.name;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url:
        successUrl ||
        `${process.env.CLIENT_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL}/cart`,
      metadata,
      billing_address_collection: "required",
      // Only collect shipping address if not pre-collected on frontend
      ...(hasPreCollectedAddress
        ? {}
        : {
            shipping_address_collection: {
              allowed_countries: ["US", "CA", "GB", "AU"],
            },
            phone_number_collection: {
              enabled: true,
            },
          }),
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    return res
      .status(500)
      .json({ message: "Failed to create checkout session" });
  }
});

router.post("/retry-payment", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const { orderId, successUrl, cancelUrl } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // Fetch the existing order with its items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order payment is actually failed
    if (order.paymentStatus !== "FAILED") {
      return res.status(400).json({
        message: "Can only retry payment for failed orders",
        currentStatus: order.paymentStatus,
      });
    }

    // Convert order items to Stripe line items
    const line_items = order.orderItems.map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: String(item.productName || item.productId || "Item"),
        },
        unit_amount: Math.max(0, Math.round(Number(item.price || 0) * 100)),
      },
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));

    // Create new Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url:
        successUrl ||
        `${process.env.CLIENT_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL}/profile`,
      metadata: {
        orderId: String(orderId),
        isRetry: "true",
      },
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
      phone_number_collection: {
        enabled: true,
      },
    });

    // Update order status to pending while payment is being retried
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PENDING",
        updatedAt: new Date(),
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Payment retry error:", err);
    return res
      .status(500)
      .json({ message: "Failed to create retry payment session" });
  }
});

// Verify payment status for stuck payments
router.post("/verify-payment-status", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // Get order from database
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // If payment has been pending for more than 1 hour, check with Stripe
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (order.paymentStatus === "PENDING" && order.updatedAt < oneHourAgo) {
      // Search for recent checkout sessions for this order
      const sessions = await stripe.checkout.sessions.list({
        limit: 10,
      });

      const orderSession = sessions.data.find(
        (session) => session.metadata?.orderId === orderId
      );

      if (orderSession) {
        if (orderSession.payment_status === "paid") {
          // Update order status to paid
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: "COMPLETED",
              status: "CONFIRMED",
              updatedAt: new Date(),
            },
          });

          return res.json({
            message: "Payment status updated to paid",
            paymentStatus: "paid",
            fixed: true,
          });
        } else if (orderSession.payment_status === "unpaid") {
          // Payment failed or was cancelled
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: "FAILED",
              updatedAt: new Date(),
            },
          });

          return res.json({
            message: "Payment status updated to failed",
            paymentStatus: "failed",
            fixed: true,
          });
        }
      } else {
        // No session found, likely expired - mark as failed
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "FAILED",
            updatedAt: new Date(),
          },
        });

        return res.json({
          message: "No payment session found, marked as failed",
          paymentStatus: "failed",
          fixed: true,
        });
      }
    }

    return res.json({
      message: "Payment status is current",
      paymentStatus: order.paymentStatus,
      fixed: false,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ message: "Failed to verify payment status" });
  }
});

// Get Stripe checkout session details
router.get("/session/:sessionId", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "customer", "payment_intent"],
    });

    res.json({
      session: {
        id: session.id,
        amount_total: session.amount_total,
        amount_subtotal: session.amount_subtotal,
        currency: session.currency,
        status: session.status,
        payment_status: session.payment_status,
        metadata: session.metadata,
        customer_details: session.customer_details,
        shipping_details: (session as any).shipping_details || null,
        line_items: session.line_items?.data || [],
      },
    });
  } catch (error: any) {
    console.error("Error fetching Stripe session:", error);
    res.status(500).json({
      error: "Failed to fetch session",
      message: error.message,
    });
  }
});

// Stripe webhook handler
router.post("/webhook", async (req, res) => {
  const webhookStartTime = Date.now();
  console.log("🔔 Webhook received:", {
    timestamp: new Date().toISOString(),
    headers: {
      "stripe-signature": req.headers["stripe-signature"]
        ? "present"
        : "missing",
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
    },
    bodySize: req.body ? Buffer.byteLength(req.body) : 0,
    bodyType: typeof req.body,
    isBuffer: Buffer.isBuffer(req.body),
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });

  const stripe = getStripe();
  if (!stripe) {
    console.error("❌ Stripe not configured");
    return res.status(503).send("Stripe not configured");
  }

  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log("🔐 Webhook security check:", {
    hasSignature: !!sig,
    hasSecret: !!webhookSecret,
    secretLength: webhookSecret ? webhookSecret.length : 0,
    secretPrefix: webhookSecret
      ? webhookSecret.substring(0, 10) + "..."
      : "none",
  });

  if (!sig || !webhookSecret) {
    console.error("❌ Missing webhook signature or secret", {
      hasSignature: !!sig,
      hasSecret: !!webhookSecret,
    });
    return res.status(400).send("Missing webhook signature or secret");
  }

  let event: Stripe.Event;
  try {
    console.log("🔍 Verifying webhook signature...");
    // Pass req.body directly - it should be a Buffer from express.raw()
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log("✅ Webhook event verified successfully:", {
      type: event.type,
      id: event.id,
      created: new Date(event.created * 1000).toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    console.error("Debug info:", {
      bodyType: typeof req.body,
      isBuffer: Buffer.isBuffer(req.body),
      bodySize: req.body ? Buffer.byteLength(req.body) : 0,
      hasSignature: !!sig,
      hasSecret: !!webhookSecret,
    });
    return res.status(400).send("Webhook Error");
  }

  try {
    console.log(`🎯 Processing webhook event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Retrieve the full session to get shipping details
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items", "payment_intent"],
      });

      const orderId = fullSession.metadata?.orderId;
      const isRetry = fullSession.metadata?.isRetry === "true";

      console.log("💳 Processing checkout.session.completed:", {
        sessionId: fullSession.id,
        orderId,
        isRetry,
        paymentStatus: fullSession.payment_status,
      });

      if (orderId) {
        // Update existing order (retry payment scenario)
        const existingOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: true,
          },
        });

        if (!existingOrder) {
          console.error("❌ Order not found for webhook:", orderId);
          return res.status(404).json({ error: "Order not found" });
        }

        const shippingDetails: any =
          (fullSession as any).shipping_details || null;
        const customerDetails: any =
          (fullSession as any).customer_details || null;

        // Extract payment intent ID
        const paymentIntentId =
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : (fullSession.payment_intent as any)?.id || null;

        const updateData: any = {
          paymentStatus: "COMPLETED",
          status: "CONFIRMED",
          paymentId: paymentIntentId,
          updatedAt: new Date(),
        };

        // Update shipping address if Stripe collected it
        if (shippingDetails || customerDetails) {
          const addressData =
            shippingDetails?.address || customerDetails?.address;
          if (addressData) {
            updateData.shippingStreet = addressData.line1 || "";
            updateData.shippingCity = addressData.city || "";
            updateData.shippingState = addressData.state || "";
            updateData.shippingZip = addressData.postal_code || "";
            updateData.shippingZipCode = addressData.postal_code || "";
            updateData.shippingCountry = addressData.country || "";

            if (customerDetails?.name) {
              const nameParts = customerDetails.name.split(" ");
              updateData.shippingFirstName = nameParts[0] || null;
              updateData.shippingLastName =
                nameParts.slice(1).join(" ") || null;
            }

            if (customerDetails?.email) {
              updateData.guestEmail = customerDetails.email;
            }

            if (customerDetails?.phone || shippingDetails?.phone) {
              updateData.shippingPhone =
                customerDetails?.phone || shippingDetails?.phone || null;
            }
          }
        }

        await prisma.order.update({
          where: { id: orderId },
          data: updateData,
        });

        console.log("✅ Order updated successfully:", orderId);

        // Create Shippo shipment if shipping rate is in metadata
        const shippingRateId = fullSession.metadata?.shippingRateId;
        if (shippingRateId && existingOrder.shippingStreet) {
          try {
            const { createShipment } = await import(
              "../services/shipmentService"
            );

            const shippingAddress = {
              name:
                existingOrder.shippingFirstName &&
                existingOrder.shippingLastName
                  ? `${existingOrder.shippingFirstName} ${existingOrder.shippingLastName}`
                  : existingOrder.shippingFirstName || "Customer",
              street: existingOrder.shippingStreet || "",
              city: existingOrder.shippingCity || "",
              state: existingOrder.shippingState || "",
              zip:
                existingOrder.shippingZip ||
                existingOrder.shippingZipCode ||
                "",
              country: existingOrder.shippingCountry || "US",
              email: existingOrder.guestEmail || "",
              phone: existingOrder.shippingPhone || "",
            };

            const shippingRateInfo = {
              objectId: shippingRateId,
              carrier: fullSession.metadata?.shippingCarrier || "",
              amount: fullSession.metadata?.shippingAmount
                ? parseFloat(fullSession.metadata.shippingAmount)
                : 0,
              serviceName: fullSession.metadata?.shippingService || "",
            };

            await createShipment(
              {
                orderId: existingOrder.id,
                toAddress: {
                  name: shippingAddress.name,
                  street1: shippingAddress.street,
                  city: shippingAddress.city,
                  state: shippingAddress.state,
                  zip: shippingAddress.zip,
                  country: shippingAddress.country,
                  email: shippingAddress.email,
                  phone: shippingAddress.phone,
                },
                parcels: [
                  {
                    length: "6",
                    width: "4",
                    height: "2",
                    weight: "0.5",
                    massUnit: "lb" as const,
                    distanceUnit: "in" as const,
                  },
                ],
              },
              shippingRateId,
              shippingRateInfo
            );

            console.log("📦 Shippo shipment created for order");
          } catch (shipmentError) {
            console.error(
              "⚠️ Failed to create Shippo shipment:",
              shipmentError
            );
          }
        }

        // Send confirmation email
        try {
          const { sendEmail, emailTemplates } = await import(
            "../services/emailService"
          );

          const customerEmail =
            existingOrder.guestEmail ||
            (existingOrder.userId
              ? (
                  await prisma.user.findUnique({
                    where: { id: existingOrder.userId },
                    select: { email: true },
                  })
                )?.email
              : null);

          if (customerEmail) {
            // Fetch updated order with shipment details
            const orderWithShipping = await prisma.order.findUnique({
              where: { id: existingOrder.id },
              select: {
                trackingNumber: true,
                trackingUrl: true,
                shippingCarrier: true,
                shippingService: true,
                shippingCost: true,
              },
            });

            const customerName =
              existingOrder.shippingFirstName && existingOrder.shippingLastName
                ? `${existingOrder.shippingFirstName} ${existingOrder.shippingLastName}`
                : existingOrder.shippingFirstName || "Customer";

            const emailData = {
              customerName,
              orderNumber: existingOrder.orderNumber || existingOrder.id,
              orderId: existingOrder.id,
              orderDate: new Date(existingOrder.createdAt).toLocaleDateString(),
              status: "CONFIRMED",
              items: existingOrder.orderItems.map((item: any) => ({
                name: item.productName || "Product",
                quantity: item.quantity,
                price: item.price,
              })),
              total: existingOrder.totalAmount,
              shippingAddress: {
                firstName: existingOrder.shippingFirstName || "",
                lastName: existingOrder.shippingLastName || "",
                address: existingOrder.shippingStreet || "",
                city: existingOrder.shippingCity || "",
                state: existingOrder.shippingState || "",
                zipCode:
                  existingOrder.shippingZip ||
                  existingOrder.shippingZipCode ||
                  "",
              },
              shippingDetails: orderWithShipping
                ? {
                    trackingNumber: orderWithShipping.trackingNumber,
                    trackingUrl: orderWithShipping.trackingUrl,
                    carrier: orderWithShipping.shippingCarrier,
                    service: orderWithShipping.shippingService,
                    shippingCost: orderWithShipping.shippingCost
                      ? Number(orderWithShipping.shippingCost)
                      : null,
                  }
                : undefined,
            };

            await sendEmail({
              to: customerEmail,
              subject: "Order Confirmation - Licorice Ropes",
              html: emailTemplates.orderConfirmation(emailData),
            });
            console.log("✅ Order confirmation email sent to:", customerEmail);
          }
        } catch (emailError) {
          console.warn("❌ Email service not available:", emailError);
        }
      } else if (fullSession.metadata?.products) {
        // Create NEW order from metadata (NO pending order was created)
        console.log("📝 Creating new order from webhook metadata");

        const metadata = fullSession.metadata;

        // Parse product data from metadata: "pid1:qty1:price1,pid2:qty2:price2"
        const productData = metadata.products.split(",").map((item: string) => {
          const [productId, quantity, price] = item.split(":");
          return {
            productId,
            quantity: parseInt(quantity) || 1,
            price: parseFloat(price) || 0,
          };
        });

        // Get shipping address - from metadata or Stripe-collected
        let shippingAddress: any = {};
        const shippingDetails: any =
          (fullSession as any).shipping_details || null;
        const customerDetails: any =
          (fullSession as any).customer_details || null;

        if (metadata.addrName) {
          // Address was pre-collected on frontend (from metadata)
          shippingAddress = {
            name: metadata.addrName,
            email: metadata.guestEmail || customerDetails?.email || "",
            phone: metadata.addrPhone || customerDetails?.phone || "",
            street: metadata.addrStreet,
            city: metadata.addrCity,
            state: metadata.addrState,
            zip: metadata.addrZip,
            country: metadata.addrCountry || "US",
          };
        } else if (shippingDetails || customerDetails) {
          // Address was collected by Stripe
          const addressData =
            shippingDetails?.address || customerDetails?.address;
          if (addressData) {
            shippingAddress = {
              name: shippingDetails?.name || customerDetails?.name || "",
              email: customerDetails?.email || metadata.guestEmail || "",
              phone: customerDetails?.phone || shippingDetails?.phone || "",
              street: addressData.line1 || "",
              city: addressData.city || "",
              state: addressData.state || "",
              zip: addressData.postal_code || "",
              country: addressData.country || "US",
            };
          }
        }

        // Calculate totals from Stripe session
        const amountTotal = fullSession.amount_total
          ? fullSession.amount_total / 100
          : 0;
        const shippingAmount = metadata.shippingAmount
          ? parseFloat(metadata.shippingAmount)
          : 0;
        const taxAmount =
          amountTotal -
          shippingAmount -
          productData.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

        // Generate unique order number
        const orderNumber = `ORD-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`;

        // Extract payment intent ID
        const paymentIntentId =
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : (fullSession.payment_intent as any)?.id || null;

        // Create order with order items
        const newOrder = await prisma.$transaction(async (tx) => {
          // Create order
          const order = await tx.order.create({
            data: {
              orderNumber,
              userId: metadata.userId || null,
              guestEmail: shippingAddress.email || metadata.guestEmail || null,
              totalAmount: amountTotal,
              shippingAmount,
              taxAmount,
              status: "CONFIRMED",
              paymentStatus: "COMPLETED",
              paymentId: paymentIntentId,
              orderNotes: metadata.notes || "",
              shippingFirstName: shippingAddress.name?.split(" ")[0] || null,
              shippingLastName:
                shippingAddress.name?.split(" ").slice(1).join(" ") || null,
              shippingStreet: shippingAddress.street || null,
              shippingCity: shippingAddress.city || null,
              shippingState: shippingAddress.state || null,
              shippingZip: shippingAddress.zip || null,
              shippingZipCode: shippingAddress.zip || null,
              shippingCountry: shippingAddress.country || null,
              shippingPhone: shippingAddress.phone || null,
            },
          });

          // Create order items
          const orderItems = [];
          for (const item of productData) {
            // Get product name from database
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { name: true },
            });

            const orderItem = await tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: item.productId,
                productName: product?.name || "Product",
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
              },
            });
            orderItems.push(orderItem);
          }

          return { order, orderItems };
        });

        console.log("✅ New order created successfully:", newOrder.order.id);

        // Get shipping rate info from metadata
        const shippingRateId = metadata.shippingRateId;
        const shippingRateInfo = shippingRateId
          ? {
              objectId: shippingRateId,
              carrier: metadata.shippingCarrier || "",
              amount: metadata.shippingAmount
                ? parseFloat(metadata.shippingAmount)
                : 0,
              serviceName: metadata.shippingService || "",
            }
          : null;

        // Create Shippo shipment if shipping rate is provided
        if (shippingRateId && shippingRateInfo && shippingAddress.street) {
          try {
            const { createShipment } = await import(
              "../services/shipmentService"
            );

            await createShipment(
              {
                orderId: newOrder.order.id,
                toAddress: {
                  name: shippingAddress.name || "Customer",
                  street1: shippingAddress.street,
                  city: shippingAddress.city,
                  state: shippingAddress.state,
                  zip: shippingAddress.zip,
                  country: shippingAddress.country || "US",
                  email: shippingAddress.email || "",
                  phone: shippingAddress.phone || "",
                },
                parcels: [
                  {
                    length: "6",
                    width: "4",
                    height: "2",
                    weight: "0.5",
                    massUnit: "lb" as const,
                    distanceUnit: "in" as const,
                  },
                ],
              },
              shippingRateId,
              {
                carrier: shippingRateInfo.carrier,
                amount: shippingRateInfo.amount,
                serviceName: shippingRateInfo.serviceName,
              }
            );

            console.log("📦 Shippo shipment created for new order");
          } catch (shipmentError) {
            console.error(
              "⚠️ Failed to create Shippo shipment:",
              shipmentError
            );
          }
        }

        // Send confirmation email
        try {
          const { sendEmail, emailTemplates } = await import(
            "../services/emailService"
          );

          const customerEmail =
            shippingAddress.email ||
            metadata.guestEmail ||
            (metadata.userId
              ? (
                  await prisma.user.findUnique({
                    where: { id: metadata.userId },
                    select: { email: true },
                  })
                )?.email
              : null);

          if (customerEmail) {
            // Fetch order with shipment details
            const orderWithShipping = await prisma.order.findUnique({
              where: { id: newOrder.order.id },
              select: {
                trackingNumber: true,
                trackingUrl: true,
                shippingCarrier: true,
                shippingService: true,
                shippingCost: true,
              },
            });

            const emailData = {
              customerName: shippingAddress.name || "Customer",
              orderNumber: newOrder.order.orderNumber,
              orderId: newOrder.order.id,
              orderDate: new Date(
                newOrder.order.createdAt
              ).toLocaleDateString(),
              status: "CONFIRMED",
              items: newOrder.orderItems.map((item: any) => ({
                name: item.productName || "Product",
                quantity: item.quantity,
                price: item.price,
              })),
              total: newOrder.order.totalAmount,
              shippingAddress: {
                firstName: shippingAddress.name?.split(" ")[0] || "",
                lastName:
                  shippingAddress.name?.split(" ").slice(1).join(" ") || "",
                address: shippingAddress.street || "",
                city: shippingAddress.city || "",
                state: shippingAddress.state || "",
                zipCode: shippingAddress.zip || "",
              },
              shippingDetails: orderWithShipping
                ? {
                    trackingNumber: orderWithShipping.trackingNumber,
                    trackingUrl: orderWithShipping.trackingUrl,
                    carrier: orderWithShipping.shippingCarrier,
                    service: orderWithShipping.shippingService,
                    shippingCost: orderWithShipping.shippingCost
                      ? Number(orderWithShipping.shippingCost)
                      : null,
                  }
                : undefined,
            };

            await sendEmail({
              to: customerEmail,
              subject: "Order Confirmation - Licorice Ropes",
              html: emailTemplates.orderConfirmation(emailData),
            });
            console.log("✅ Order confirmation email sent to:", customerEmail);
          }
        } catch (emailError) {
          console.warn("❌ Email service not available:", emailError);
        }
      } else {
        console.error("❌ Missing order data in webhook metadata");
        return res
          .status(400)
          .json({ error: "Missing order data in metadata" });
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      console.log("❌ Payment failed:", pi.id);

      // Try to find the order and mark as failed
      const orderId = pi.metadata?.orderId;
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
            updatedAt: new Date(),
          },
        });
        console.log("✅ Order marked as failed:", orderId);
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      console.log("💸 Charge refunded:", charge.id);

      // Find order by payment ID and mark as refunded
      const order = await prisma.order.findFirst({
        where: { paymentId: charge.payment_intent as string },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "REFUNDED",
            status: "REFUNDED",
            updatedAt: new Date(),
          },
        });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Health check endpoint
router.get("/health", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    return res.json({
      status: "healthy",
      configured: {
        hasStripe: !!stripe,
        hasWebhookSecret: !!webhookSecret,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Health check failed" });
  }
});

export default router;
