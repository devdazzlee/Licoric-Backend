import { Request, Response } from 'express';
import { validateAddress, getShippingRates, createShipment, handleWebhookEvent } from '../services/shipmentService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Validate shipping address
export const validateShippingAddress = async (req: Request, res: Response) => {
  try {
    const address = req.body;
    
    if (!address.name || !address.street1 || !address.city || !address.state || !address.zip || !address.country) {
      return res.status(400).json({ 
        error: 'Missing required address fields',
        required: ['name', 'street1', 'city', 'state', 'zip', 'country']
      });
    }

    const result = await validateAddress(address);
    
    res.json({
      isValid: result.isValid,
      validatedAddress: result.validatedAddress,
      suggestions: result.suggestions,
      message: result.isValid ? 'Address validated successfully' : 'Address validation completed with suggestions'
    });
  } catch (error) {
    console.error('Address validation error:', error);
    res.status(500).json({ error: 'Failed to validate address' });
  }
};

// Get shipping rates
export const getShippingRatesController = async (req: Request, res: Response) => {
  try {
    const { address, parcels } = req.body;
    
    if (!address || !parcels || !Array.isArray(parcels)) {
      return res.status(400).json({ 
        error: 'Address and parcels are required',
        required: ['address', 'parcels']
      });
    }

    const rates = await getShippingRates(address, parcels);
    
    res.json({ rates });
  } catch (error) {
    console.error('Shipping rates error:', error);
    res.status(500).json({ error: 'Failed to get shipping rates' });
  }
};

// Calculate shipping rates for checkout (before payment)
export const calculateCheckoutRates = async (req: Request, res: Response) => {
  try {
    const { shippingAddress, orderItems } = req.body;
    
    if (!shippingAddress || !orderItems || !Array.isArray(orderItems)) {
      return res.status(400).json({ 
        error: 'Shipping address and order items are required',
        required: ['shippingAddress', 'orderItems']
      });
    }

    console.log('📦 Calculating checkout shipping rates for:', {
      address: shippingAddress,
      itemsCount: orderItems.length,
    });

    // Calculate total weight and dimensions based on items
    let totalWeight = 0;
    let totalItems = 0;
    
    // Filter out items with invalid productIds
    const validItems = orderItems.filter(item => {
      if (!item.productId || item.productId === null || item.productId === undefined || item.productId === '') {
        console.warn('⚠️ Skipping item with missing productId:', item);
        return false;
      }
      return true;
    });

    if (validItems.length === 0) {
      return res.status(400).json({ 
        error: 'No valid items found in order. Please refresh your cart.',
        code: 'INVALID_CART_ITEMS'
      });
    }
    
    for (const item of validItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      
      if (!product) {
        console.warn('⚠️ Product not found:', item.productId);
        continue; // Skip products that don't exist
      }
      
      totalItems += item.quantity;
      // Estimate 0.5 lbs per regular product (same as Licrorice)
      totalWeight += item.quantity * 0.5;
    }

    if (totalItems === 0) {
      return res.status(400).json({ 
        error: 'No valid products found. Please refresh your cart.',
        code: 'NO_VALID_PRODUCTS'
      });
    }

    // Create parcel based on total items (simplified)
    const parcels = [{
      length: String(Math.ceil(totalItems / 3) * 4 + 2), // Estimate length
      width: "8",
      height: "6",
      distanceUnit: "in" as "in",
      weight: String(totalWeight || 1), // Minimum 1 lb
      massUnit: "lb" as "lb"
    }];

    console.log('📦 Calculated parcels:', parcels);

    // Get shipping rates from Shippo
    const rates = await getShippingRates(shippingAddress, parcels);
    
    // Format rates for frontend
    const formattedRates = rates.map((rate: any) => ({
      objectId: rate.objectId,
      carrier: rate.carrier,
      serviceName: rate.serviceName,
      amount: rate.amount,
      estimatedDays: rate.estimatedDays,
      currency: rate.currency,
    }));

    console.log('✅ Shipping rates calculated:', formattedRates);

    res.json({ 
      rates: formattedRates,
      parcels 
    });
  } catch (error) {
    console.error('Checkout rates calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate shipping rates' });
  }
};

// Create shipment
export const createShipmentController = async (req: Request, res: Response) => {
  try {
    const { orderId, address, parcels, selectedRateId, rateData } = req.body;
    
    if (!orderId || !address || !parcels || !selectedRateId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['orderId', 'address', 'parcels', 'selectedRateId']
      });
    }

    const shipment = await createShipment(
      { orderId, toAddress: address, parcels }, 
      selectedRateId,
      rateData // Optional: { carrier, amount, serviceName }
    );
    
    res.json(shipment);
  } catch (error) {
    console.error('Shipment creation error:', error);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
};

// Shippo webhook handler
export const shippoWebhook = async (req: Request, res: Response) => {
  try {
    console.log('📦 Shippo webhook received:', {
      headers: {
        'x-shippo-event': req.headers['x-shippo-event'],
        'content-type': req.headers['content-type'],
      },
      bodyType: typeof req.body,
      isBuffer: Buffer.isBuffer(req.body),
      timestamp: new Date().toISOString(),
    });

    // Parse body if it's a Buffer (from raw body parser)
    let parsedBody: any;
    if (Buffer.isBuffer(req.body)) {
      parsedBody = JSON.parse(req.body.toString());
    } else {
      parsedBody = req.body;
    }

    const { event, data } = parsedBody;
    
    console.log('📦 Webhook event:', {
      event,
      transactionId: data?.object_id,
      trackingNumber: data?.tracking_number,
      status: data?.status,
    });
    
    if (!event || !data) {
      console.error('❌ Missing event or data in webhook');
      return res.status(400).json({ error: 'Missing event or data' });
    }

    await handleWebhookEvent(event, data);
    
    console.log('✅ Shippo webhook processed successfully');
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Shippo webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

