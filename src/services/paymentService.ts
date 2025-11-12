import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { PaymentIntentRequest, PaymentIntentResponse, PaymentConfirmationRequest } from '../types';

const prisma = new PrismaClient();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
} as any);

export class PaymentService {
  /**
   * Create a payment intent for an order
   */
  static async createPaymentIntent(data: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    try {
      // Verify order exists and get amount
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { 
          user: true,
          payment: true
        }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.payment) {
        throw new Error('Payment already exists for this order');
      }

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency,
        metadata: {
          orderId: data.orderId,
          userId: order.userId,
          customerEmail: order.user.email
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Create payment record in database
      await prisma.payment.create({
        data: {
          orderId: data.orderId,
          paymentIntentId: paymentIntent.id,
          amount: data.amount,
          currency: data.currency,
          method: 'card',
          provider: 'stripe',
          status: 'PENDING'
        }
      });

      return {
        clientSecret: paymentIntent.client_secret || '',
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Confirm payment and update order status
   */
  static async confirmPayment(data: PaymentConfirmationRequest): Promise<void> {
    try {
      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(data.paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }

      // Update payment record
      await prisma.payment.update({
        where: { paymentIntentId: data.paymentIntentId },
        data: {
          status: 'COMPLETED',
          transactionId: paymentIntent.id,
          metadata: paymentIntent.metadata
        }
      });

      // Update order status
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'COMPLETED',
          paymentId: paymentIntent.id
        }
      });

      // Create notification for user
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { userId: true }
      });

      if (order) {
        await prisma.notification.create({
          data: {
            userId: order.userId,
            title: 'Payment Successful',
            message: `Your payment for order #${data.orderId} has been processed successfully.`,
            type: 'PAYMENT',
            relatedId: data.orderId
          }
        });
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      
      // Update payment status to failed
      await prisma.payment.update({
        where: { paymentIntentId: data.paymentIntentId },
        data: {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'charge.dispute.created':
          await this.handleDispute(event.data.object as Stripe.Dispute);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private static async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    
    if (!orderId) return;

    // Update payment record
    await prisma.payment.update({
      where: { paymentIntentId: paymentIntent.id },
      data: {
        status: 'COMPLETED',
        transactionId: paymentIntent.id
      }
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'COMPLETED'
      }
    });

    // Create notification
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true }
    });

    if (order) {
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: 'Payment Successful',
          message: `Your payment has been processed successfully.`,
          type: 'PAYMENT',
          relatedId: orderId
        }
      });
    }
  }

  /**
   * Handle failed payment
   */
  private static async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    
    if (!orderId) return;

    // Update payment record
    await prisma.payment.update({
      where: { paymentIntentId: paymentIntent.id },
      data: {
        status: 'FAILED',
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
      }
    });

    // Create notification
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true }
    });

    if (order) {
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: 'Payment Failed',
          message: `Your payment could not be processed. Please try again.`,
          type: 'PAYMENT',
          relatedId: orderId
        }
      });
    }
  }

  /**
   * Handle dispute
   */
  private static async handleDispute(dispute: Stripe.Dispute): Promise<void> {
    // Log dispute for admin review
    await prisma.auditLog.create({
      data: {
        action: 'DISPUTE_CREATED',
        entity: 'Payment',
        entityId: dispute.charge as string,
        newValues: {
          disputeId: dispute.id,
          amount: dispute.amount,
          reason: dispute.reason,
          status: dispute.status
        }
      }
    });
  }

  /**
   * Create refund for an order
   */
  static async createRefund(orderId: string, amount?: number, reason?: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true }
      });

      if (!order || !order.payment) {
        throw new Error('Order or payment not found');
      }

      if (order.payment.status !== 'COMPLETED') {
        throw new Error('Cannot refund incomplete payment');
      }

      const refundAmount = amount ? Math.round(amount * 100) : undefined;

      // Create Stripe refund
      const refund = await stripe.refunds.create({
        payment_intent: order.payment.paymentIntentId,
        ...(refundAmount && { amount: refundAmount }),
        reason: reason as any || 'requested_by_customer'
      });

      // Update payment status
      const orderTotalCents = Math.round(Number(order.totalAmount) * 100);
      const newStatus = refund.amount === orderTotalCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      
      const currentMetadata = order.payment.metadata as any || {};
      
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          status: newStatus,
          metadata: {
            ...currentMetadata,
            refundId: refund.id,
            refundAmount: refund.amount / 100
          }
        }
      });

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'REFUNDED',
          paymentStatus: newStatus
        }
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: 'Refund Processed',
          message: `Your refund of $${(refund.amount / 100).toFixed(2)} has been processed.`,
          type: 'PAYMENT',
          relatedId: orderId
        }
      });
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  /**
   * Get payment methods for a customer
   */
  static async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  }
}
