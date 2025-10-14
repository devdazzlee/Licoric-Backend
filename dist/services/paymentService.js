"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-06-20',
});
class PaymentService {
    static async createPaymentIntent(data) {
        try {
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
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(data.amount * 100),
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
        }
        catch (error) {
            console.error('Error creating payment intent:', error);
            throw error;
        }
    }
    static async confirmPayment(data) {
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(data.paymentIntentId);
            if (paymentIntent.status !== 'succeeded') {
                throw new Error(`Payment failed with status: ${paymentIntent.status}`);
            }
            await prisma.payment.update({
                where: { paymentIntentId: data.paymentIntentId },
                data: {
                    status: 'COMPLETED',
                    transactionId: paymentIntent.id,
                    metadata: paymentIntent.metadata
                }
            });
            await prisma.order.update({
                where: { id: data.orderId },
                data: {
                    status: 'CONFIRMED',
                    paymentStatus: 'COMPLETED',
                    paymentId: paymentIntent.id
                }
            });
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
        }
        catch (error) {
            console.error('Error confirming payment:', error);
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
    static async handleWebhook(event) {
        try {
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSuccess(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailure(event.data.object);
                    break;
                case 'charge.dispute.created':
                    await this.handleDispute(event.data.object);
                    break;
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
        }
        catch (error) {
            console.error('Error handling webhook:', error);
            throw error;
        }
    }
    static async handlePaymentSuccess(paymentIntent) {
        const orderId = paymentIntent.metadata.orderId;
        if (!orderId)
            return;
        await prisma.payment.update({
            where: { paymentIntentId: paymentIntent.id },
            data: {
                status: 'COMPLETED',
                transactionId: paymentIntent.id
            }
        });
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'CONFIRMED',
                paymentStatus: 'COMPLETED'
            }
        });
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
    static async handlePaymentFailure(paymentIntent) {
        const orderId = paymentIntent.metadata.orderId;
        if (!orderId)
            return;
        await prisma.payment.update({
            where: { paymentIntentId: paymentIntent.id },
            data: {
                status: 'FAILED',
                failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
            }
        });
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
    static async handleDispute(dispute) {
        await prisma.auditLog.create({
            data: {
                action: 'DISPUTE_CREATED',
                entity: 'Payment',
                entityId: dispute.charge,
                newValues: {
                    disputeId: dispute.id,
                    amount: dispute.amount,
                    reason: dispute.reason,
                    status: dispute.status
                }
            }
        });
    }
    static async createRefund(orderId, amount, reason) {
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
            const refund = await stripe.refunds.create({
                payment_intent: order.payment.paymentIntentId,
                ...(refundAmount && { amount: refundAmount }),
                reason: reason || 'requested_by_customer'
            });
            const orderTotalCents = Math.round(Number(order.totalAmount) * 100);
            const newStatus = refund.amount === orderTotalCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
            const currentMetadata = order.payment.metadata || {};
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
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'REFUNDED',
                    paymentStatus: newStatus
                }
            });
            await prisma.notification.create({
                data: {
                    userId: order.userId,
                    title: 'Refund Processed',
                    message: `Your refund of $${(refund.amount / 100).toFixed(2)} has been processed.`,
                    type: 'PAYMENT',
                    relatedId: orderId
                }
            });
        }
        catch (error) {
            console.error('Error creating refund:', error);
            throw error;
        }
    }
    static async getPaymentMethods(customerId) {
        try {
            const paymentMethods = await stripe.paymentMethods.list({
                customer: customerId,
                type: 'card',
            });
            return paymentMethods.data;
        }
        catch (error) {
            console.error('Error fetching payment methods:', error);
            throw error;
        }
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=paymentService.js.map