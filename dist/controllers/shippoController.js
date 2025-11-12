"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippoWebhook = exports.createShipmentController = exports.calculateCheckoutRates = exports.getShippingRatesController = exports.validateShippingAddress = void 0;
const shipmentService_1 = require("../services/shipmentService");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const validateShippingAddress = async (req, res) => {
    try {
        const address = req.body;
        if (!address.name || !address.street1 || !address.city || !address.state || !address.zip || !address.country) {
            return res.status(400).json({
                error: 'Missing required address fields',
                required: ['name', 'street1', 'city', 'state', 'zip', 'country']
            });
        }
        const result = await (0, shipmentService_1.validateAddress)(address);
        res.json({
            isValid: result.isValid,
            validatedAddress: result.validatedAddress,
            suggestions: result.suggestions,
            message: result.isValid ? 'Address validated successfully' : 'Address validation completed with suggestions'
        });
    }
    catch (error) {
        console.error('Address validation error:', error);
        res.status(500).json({ error: 'Failed to validate address' });
    }
};
exports.validateShippingAddress = validateShippingAddress;
const getShippingRatesController = async (req, res) => {
    try {
        const { address, parcels } = req.body;
        if (!address || !parcels || !Array.isArray(parcels)) {
            return res.status(400).json({
                error: 'Address and parcels are required',
                required: ['address', 'parcels']
            });
        }
        const rates = await (0, shipmentService_1.getShippingRates)(address, parcels);
        res.json({ rates });
    }
    catch (error) {
        console.error('Shipping rates error:', error);
        res.status(500).json({ error: 'Failed to get shipping rates' });
    }
};
exports.getShippingRatesController = getShippingRatesController;
const calculateCheckoutRates = async (req, res) => {
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
        let totalWeight = 0;
        let totalItems = 0;
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
                continue;
            }
            totalItems += item.quantity;
            totalWeight += item.quantity * 0.5;
        }
        if (totalItems === 0) {
            return res.status(400).json({
                error: 'No valid products found. Please refresh your cart.',
                code: 'NO_VALID_PRODUCTS'
            });
        }
        const parcels = [{
                length: String(Math.ceil(totalItems / 3) * 4 + 2),
                width: "8",
                height: "6",
                distanceUnit: "in",
                weight: String(totalWeight || 1),
                massUnit: "lb"
            }];
        console.log('📦 Calculated parcels:', parcels);
        const rates = await (0, shipmentService_1.getShippingRates)(shippingAddress, parcels);
        const formattedRates = rates.map((rate) => ({
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
    }
    catch (error) {
        console.error('Checkout rates calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate shipping rates' });
    }
};
exports.calculateCheckoutRates = calculateCheckoutRates;
const createShipmentController = async (req, res) => {
    try {
        const { orderId, address, parcels, selectedRateId, rateData } = req.body;
        if (!orderId || !address || !parcels || !selectedRateId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['orderId', 'address', 'parcels', 'selectedRateId']
            });
        }
        const shipment = await (0, shipmentService_1.createShipment)({ orderId, toAddress: address, parcels }, selectedRateId, rateData);
        res.json(shipment);
    }
    catch (error) {
        console.error('Shipment creation error:', error);
        res.status(500).json({ error: 'Failed to create shipment' });
    }
};
exports.createShipmentController = createShipmentController;
const shippoWebhook = async (req, res) => {
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
        let parsedBody;
        if (Buffer.isBuffer(req.body)) {
            parsedBody = JSON.parse(req.body.toString());
        }
        else {
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
        await (0, shipmentService_1.handleWebhookEvent)(event, data);
        console.log('✅ Shippo webhook processed successfully');
        res.json({ received: true });
    }
    catch (error) {
        console.error('❌ Shippo webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};
exports.shippoWebhook = shippoWebhook;
//# sourceMappingURL=shippoController.js.map