"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key)
        return null;
    return new stripe_1.default(key, { apiVersion: "2024-06-20" });
}
router.post("/create-checkout-session", async (req, res) => {
    try {
        const stripe = getStripe();
        if (!stripe) {
            return res.status(503).json({ message: "Stripe not configured" });
        }
        const { orderId, orderData, items, successUrl, cancelUrl, selectedShippingRate } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "No items provided" });
        }
        const line_items = items.map((it) => ({
            price_data: {
                currency: "usd",
                product_data: { name: String(it.productName || it.name || "Item") },
                unit_amount: Math.max(0, Math.round(Number(it.price || 0) * 100)),
            },
            quantity: Math.max(1, Number(it.quantity || 1)),
        }));
        const metadata = {};
        if (orderId) {
            metadata.orderId = String(orderId);
        }
        else if (orderData) {
            const compressedData = {
                total: orderData.total,
                notes: orderData.orderNotes,
                userId: orderData.userId || null,
                items: orderData.orderItems.map((item) => ({
                    pid: item.productId,
                    qty: item.quantity,
                    price: item.price,
                    total: item.total,
                    name: item.productName || item.name || 'Product',
                })),
            };
            if (orderData.shippingAddress) {
                compressedData.address = {
                    name: orderData.shippingAddress.name,
                    email: orderData.shippingAddress.email,
                    phone: orderData.shippingAddress.phone,
                    street: orderData.shippingAddress.street,
                    city: orderData.shippingAddress.city,
                    state: orderData.shippingAddress.state,
                    zip: orderData.shippingAddress.zipCode,
                    country: orderData.shippingAddress.country,
                };
            }
            if (selectedShippingRate) {
                compressedData.shippingRate = {
                    objectId: selectedShippingRate.objectId,
                    carrier: selectedShippingRate.carrier,
                    amount: selectedShippingRate.amount,
                    serviceName: selectedShippingRate.serviceName,
                };
            }
            const dataString = JSON.stringify(compressedData);
            if (dataString.length > 500) {
                return res.status(400).json({ message: "Order data too large for Stripe metadata" });
            }
            metadata.orderData = dataString;
        }
        const hasPreCollectedAddress = orderData?.shippingAddress?.name;
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items,
            success_url: successUrl ||
                `${process.env.CLIENT_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${process.env.CLIENT_URL}/cart`,
            metadata,
            billing_address_collection: "required",
            ...(hasPreCollectedAddress ? {} : {
                shipping_address_collection: {
                    allowed_countries: ["US", "CA", "GB", "AU"],
                },
                phone_number_collection: {
                    enabled: true,
                },
            }),
        });
        return res.json({ url: session.url });
    }
    catch (err) {
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
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: true,
            },
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (order.paymentStatus !== "FAILED") {
            return res.status(400).json({
                message: "Can only retry payment for failed orders",
                currentStatus: order.paymentStatus,
            });
        }
        const line_items = order.orderItems.map((item) => ({
            price_data: {
                currency: "usd",
                product_data: {
                    name: String(item.productName || item.productId || "Item"),
                },
                unit_amount: Math.max(0, Math.round(Number(item.price || 0) * 100)),
            },
            quantity: Math.max(1, Number(item.quantity || 1)),
        }));
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items,
            success_url: successUrl ||
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
        await prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: "PENDING",
                updatedAt: new Date(),
            },
        });
        return res.json({ url: session.url });
    }
    catch (err) {
        console.error("Payment retry error:", err);
        return res
            .status(500)
            .json({ message: "Failed to create retry payment session" });
    }
});
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
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (order.paymentStatus === "PENDING" && order.updatedAt < oneHourAgo) {
            const sessions = await stripe.checkout.sessions.list({
                limit: 10,
            });
            const orderSession = sessions.data.find((session) => session.metadata?.orderId === orderId);
            if (orderSession) {
                if (orderSession.payment_status === "paid") {
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
                }
                else if (orderSession.payment_status === "unpaid") {
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
            }
            else {
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
    }
    catch (error) {
        console.error("Payment verification error:", error);
        return res.status(500).json({ message: "Failed to verify payment status" });
    }
});
router.post("/webhook", async (req, res) => {
    const webhookStartTime = Date.now();
    console.log("🔔 Webhook received:", {
        timestamp: new Date().toISOString(),
        headers: {
            "stripe-signature": req.headers["stripe-signature"] ? "present" : "missing",
            "content-type": req.headers["content-type"],
        },
    });
    const stripe = getStripe();
    if (!stripe) {
        console.error("❌ Stripe not configured");
        return res.status(503).send("Stripe not configured");
    }
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
        console.error("❌ Missing webhook signature or secret");
        return res.status(400).send("Missing webhook signature or secret");
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log("✅ Webhook event verified successfully:", event.type);
    }
    catch (err) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return res.status(400).send("Webhook Error");
    }
    try {
        console.log(`🎯 Processing webhook event: ${event.type}`);
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
                expand: ['line_items', 'payment_intent']
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
                const existingOrder = await prisma.order.findUnique({
                    where: { id: orderId },
                });
                if (!existingOrder) {
                    console.error("❌ Order not found for webhook:", orderId);
                    return res.status(404).json({ error: "Order not found" });
                }
                const shippingDetails = fullSession.shipping_details || null;
                const customerDetails = fullSession.customer_details || null;
                const updateData = {
                    paymentStatus: "COMPLETED",
                    status: "CONFIRMED",
                    paymentId: fullSession.payment_intent,
                    updatedAt: new Date(),
                };
                if (fullSession.amount_total && fullSession.amount_total !== Math.round(Number(existingOrder.totalAmount) * 100)) {
                    updateData.totalAmount = fullSession.amount_total / 100;
                }
                if (shippingDetails || customerDetails) {
                    const addressData = shippingDetails?.address || customerDetails?.address;
                    if (addressData) {
                        updateData.shippingStreet = addressData.line1 || "";
                        updateData.shippingCity = addressData.city || "";
                        updateData.shippingState = addressData.state || "";
                        updateData.shippingZip = addressData.postal_code || "";
                        updateData.shippingCountry = addressData.country || "";
                    }
                }
                await prisma.order.update({
                    where: { id: orderId },
                    data: updateData,
                });
                console.log("✅ Order updated successfully:", orderId);
                try {
                    const { sendEmail, emailTemplates } = await Promise.resolve().then(() => __importStar(require("../services/emailService")));
                    if (existingOrder.userId) {
                        const user = await prisma.user.findUnique({
                            where: { id: existingOrder.userId },
                        });
                        if (user) {
                            await sendEmail({
                                to: user.email,
                                subject: 'Order Confirmation',
                                html: emailTemplates.orderConfirmation({ order: existingOrder }),
                            });
                        }
                    }
                }
                catch (emailError) {
                    console.warn("Email service not available:", emailError);
                }
            }
            else if (fullSession.metadata?.orderData) {
                const orderData = JSON.parse(fullSession.metadata.orderData);
                console.log("📝 Creating new order from webhook data");
                let shippingAddress = {};
                if (orderData.address) {
                    shippingAddress = orderData.address;
                }
                else {
                    const sessionAny = fullSession;
                    const stripeShipping = sessionAny.shipping_details || sessionAny.shipping;
                    const stripeCustomer = fullSession.customer_details;
                    if (stripeShipping && stripeShipping.address) {
                        shippingAddress = {
                            name: stripeShipping.name || stripeCustomer?.name || "",
                            email: stripeCustomer?.email || "",
                            phone: stripeCustomer?.phone || stripeShipping.phone || "",
                            street: stripeShipping.address.line1 || "",
                            city: stripeShipping.address.city || "",
                            state: stripeShipping.address.state || "",
                            zip: stripeShipping.address.postal_code || "",
                            country: stripeShipping.address.country || "",
                        };
                    }
                }
                const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                const newOrder = await prisma.order.create({
                    data: {
                        orderNumber,
                        userId: orderData.userId || null,
                        guestEmail: shippingAddress.email || null,
                        totalAmount: parseFloat(orderData.total.toString()),
                        status: "CONFIRMED",
                        paymentStatus: "COMPLETED",
                        paymentId: fullSession.payment_intent,
                        orderNotes: orderData.notes || "",
                        shippingStreet: shippingAddress.street || "",
                        shippingCity: shippingAddress.city || "",
                        shippingState: shippingAddress.state || "",
                        shippingZip: shippingAddress.zip || "",
                        shippingCountry: shippingAddress.country || "",
                        orderItems: {
                            create: orderData.items.map((item) => ({
                                productId: item.pid,
                                quantity: item.qty,
                                price: parseFloat(item.price.toString()),
                                total: parseFloat(item.total.toString()),
                                productName: item.name || 'Product',
                            })),
                        },
                    },
                    include: {
                        orderItems: true,
                    },
                });
                console.log("✅ New order created successfully:", newOrder.id);
                try {
                    const { sendEmail, emailTemplates } = await Promise.resolve().then(() => __importStar(require("../services/emailService")));
                    if (shippingAddress.email) {
                        await sendEmail({
                            to: shippingAddress.email,
                            subject: 'Order Confirmation',
                            html: emailTemplates.orderConfirmation({ order: newOrder }),
                        });
                    }
                }
                catch (emailError) {
                    console.warn("Email service not available:", emailError);
                }
            }
        }
        else if (event.type === "payment_intent.payment_failed") {
            const pi = event.data.object;
            console.log("❌ Payment failed:", pi.id);
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
        }
        else if (event.type === "charge.refunded") {
            const charge = event.data.object;
            console.log("💸 Charge refunded:", charge.id);
            const order = await prisma.order.findFirst({
                where: { paymentId: charge.payment_intent },
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
    }
    catch (error) {
        console.error("❌ Webhook processing error:", error);
        return res.status(500).json({ error: "Webhook processing failed" });
    }
});
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
    }
    catch (error) {
        return res.status(500).json({ message: "Health check failed" });
    }
});
exports.default = router;
//# sourceMappingURL=payment.js.map