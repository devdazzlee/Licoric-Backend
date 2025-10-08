"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const paymentService_1 = require("../services/paymentService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const createPaymentIntentValidation = [
    (0, express_validator_1.body)('amount').isNumeric().withMessage('Amount must be a number'),
    (0, express_validator_1.body)('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    (0, express_validator_1.body)('orderId').notEmpty().withMessage('Order ID is required')
];
const confirmPaymentValidation = [
    (0, express_validator_1.body)('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    (0, express_validator_1.body)('orderId').notEmpty().withMessage('Order ID is required')
];
const refundValidation = [
    (0, express_validator_1.body)('amount').optional().isNumeric().withMessage('Amount must be a number'),
    (0, express_validator_1.body)('reason').optional().isString().withMessage('Reason must be a string')
];
router.post('/create-intent', auth_1.auth, createPaymentIntentValidation, async (req, res) => {
    try {
        const { amount, currency, orderId } = req.body;
        const result = await paymentService_1.PaymentService.createPaymentIntent({
            amount,
            currency,
            orderId
        });
        res.json({
            success: true,
            message: 'Payment intent created successfully',
            data: result
        });
    }
    catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.post('/confirm', auth_1.auth, confirmPaymentValidation, async (req, res) => {
    try {
        const { paymentIntentId, orderId } = req.body;
        await paymentService_1.PaymentService.confirmPayment({
            paymentIntentId,
            orderId
        });
        res.json({
            success: true,
            message: 'Payment confirmed successfully'
        });
    }
    catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!endpointSecret) {
            console.error('Stripe webhook secret not configured');
            res.status(400).send('Webhook secret not configured');
            return;
        }
        let event;
        try {
            event = require('stripe').webhooks.constructEvent(req.body, sig, endpointSecret);
        }
        catch (err) {
            console.error('Webhook signature verification failed:', err);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }
        await paymentService_1.PaymentService.handleWebhook(event);
        res.json({ received: true });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed'
        });
    }
});
router.post('/refund/:orderId', auth_1.auth, auth_1.adminAuth, refundValidation, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { amount, reason } = req.body;
        await paymentService_1.PaymentService.createRefund(orderId, amount, reason);
        res.json({
            success: true,
            message: 'Refund created successfully'
        });
    }
    catch (error) {
        console.error('Create refund error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.get('/methods/:customerId', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { customerId } = req.params;
        if (!customerId) {
            res.status(400).json({
                success: false,
                message: 'Customer ID is required'
            });
            return;
        }
        const paymentMethods = await paymentService_1.PaymentService.getPaymentMethods(customerId);
        res.json({
            success: true,
            data: { paymentMethods }
        });
    }
    catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=payment.js.map