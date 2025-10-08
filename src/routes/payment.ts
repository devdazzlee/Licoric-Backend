import express from 'express';
import { body } from 'express-validator';
import { PaymentService } from '../services/paymentService';
import { auth, adminAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';

const router = express.Router();

// Validation middleware
const createPaymentIntentValidation = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('orderId').notEmpty().withMessage('Order ID is required')
];

const confirmPaymentValidation = [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
  body('orderId').notEmpty().withMessage('Order ID is required')
];

const refundValidation = [
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('reason').optional().isString().withMessage('Reason must be a string')
];

// @desc    Create payment intent
// @route   POST /api/payment/create-intent
// @access  Private
router.post('/create-intent', auth, createPaymentIntentValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount, currency, orderId } = req.body;

    const result = await PaymentService.createPaymentIntent({
      amount,
      currency,
      orderId
    });

    res.json({
      success: true,
      message: 'Payment intent created successfully',
      data: result
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Confirm payment
// @route   POST /api/payment/confirm
// @access  Private
router.post('/confirm', auth, confirmPaymentValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { paymentIntentId, orderId } = req.body;

    await PaymentService.confirmPayment({
      paymentIntentId,
      orderId
    });

    res.json({
      success: true,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Handle Stripe webhook
// @route   POST /api/payment/webhook
// @access  Public (webhook)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    await PaymentService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// @desc    Create refund
// @route   POST /api/payment/refund/:orderId
// @access  Private/Admin
router.post('/refund/:orderId', auth, adminAuth, refundValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { amount, reason } = req.body;

    await PaymentService.createRefund(orderId, amount, reason);

    res.json({
      success: true,
      message: 'Refund created successfully'
    });
  } catch (error) {
    console.error('Create refund error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Get payment methods for customer
// @route   GET /api/payment/methods/:customerId
// @access  Private/Admin
router.get('/methods/:customerId', auth, adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
      return;
    }

    const paymentMethods = await PaymentService.getPaymentMethods(customerId);

    res.json({
      success: true,
      data: { paymentMethods }
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export default router;
