import Stripe from 'stripe';
import { PaymentIntentRequest, PaymentIntentResponse, PaymentConfirmationRequest } from '../types';
export declare class PaymentService {
    static createPaymentIntent(data: PaymentIntentRequest): Promise<PaymentIntentResponse>;
    static confirmPayment(data: PaymentConfirmationRequest): Promise<void>;
    static handleWebhook(event: Stripe.Event): Promise<void>;
    private static handlePaymentSuccess;
    private static handlePaymentFailure;
    private static handleDispute;
    static createRefund(orderId: string, amount?: number, reason?: string): Promise<void>;
    static getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]>;
}
//# sourceMappingURL=paymentService.d.ts.map