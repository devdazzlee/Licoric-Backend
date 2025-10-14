"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTemplates = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const isEmailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;
const transporter = isEmailConfigured ? nodemailer_1.default.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
}) : null;
if (transporter) {
    transporter.verify((error) => {
        if (error) {
            console.log('❌ Email service error:', error);
        }
        else {
            console.log('✅ Email service ready');
        }
    });
}
else {
    console.log('⚠️  Email service not configured (EMAIL_USER and EMAIL_PASSWORD missing)');
    console.log('   Emails will be logged to console instead');
}
const sendEmail = async (options) => {
    if (!transporter) {
        console.log('📧 Email would be sent (not configured):');
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        return { success: true, messageId: 'mock-email-id' };
    }
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'Licorice Ropes'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            attachments: options.attachments
        });
        console.log('✅ Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error('❌ Email send error:', error);
        return { success: false, error };
    }
};
exports.sendEmail = sendEmail;
exports.emailTemplates = {
    welcome: (name) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { background: #E85A2D; color: white; padding: 12px 30px; text-decoration: none; display: inline-block; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Licorice Ropes!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name}!</h2>
          <p>Thank you for joining Licorice Ropes! We're excited to have you as part of our community.</p>
          <p>You can now:</p>
          <ul>
            <li>Browse our delicious products</li>
            <li>Save your favorite items</li>
            <li>Track your orders</li>
            <li>Enjoy exclusive discounts</li>
          </ul>
          <p style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/product" class="button">Start Shopping</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `,
    orderConfirmation: (orderData) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .order-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .item { border-bottom: 1px solid #ddd; padding: 15px 0; }
        .total { font-size: 18px; font-weight: bold; color: #E85A2D; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Thank you for your order!</h2>
          <p>Hi ${orderData.customerName},</p>
          <p>Your order has been confirmed and is being processed.</p>
          
          <div class="order-info">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
            <p><strong>Order Date:</strong> ${orderData.orderDate}</p>
            <p><strong>Status:</strong> ${orderData.status}</p>
            
            <h4>Items:</h4>
            ${orderData.items.map((item) => `
              <div class="item">
                <strong>${item.name}</strong> x ${item.quantity}<br>
                Price: $${item.price}
              </div>
            `).join('')}
            
            <p class="total">Total: $${orderData.total}</p>
          </div>
          
          <p><strong>Shipping Address:</strong><br>
          ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
          ${orderData.shippingAddress.address}<br>
          ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}
          </p>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard/orders/${orderData.orderId}" class="button">Track Order</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `,
    shippingNotification: (shipmentData) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .tracking-box { background: #FFF3CD; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
        .tracking-number { font-size: 24px; font-weight: bold; color: #856404; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📦 Your Order Has Shipped!</h1>
        </div>
        <div class="content">
          <h2>Good news!</h2>
          <p>Hi ${shipmentData.customerName},</p>
          <p>Your order #${shipmentData.orderNumber} has been shipped and is on its way to you!</p>
          
          <div class="tracking-box">
            <p><strong>Carrier:</strong> ${shipmentData.carrier}</p>
            <p><strong>Tracking Number:</strong></p>
            <p class="tracking-number">${shipmentData.trackingNumber}</p>
            <p><strong>Estimated Delivery:</strong> ${shipmentData.estimatedDelivery}</p>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard/orders/${shipmentData.orderId}" class="button">Track Shipment</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `,
    refundApproved: (refundData) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Refund Approved</h1>
        </div>
        <div class="content">
          <p>Hi ${refundData.customerName},</p>
          <p>Your refund request for order #${refundData.orderNumber} has been approved.</p>
          <p><strong>Refund Amount:</strong> $${refundData.refundAmount}</p>
          <p><strong>Processing Time:</strong> 5-7 business days</p>
          <p>The refund will be credited back to your original payment method.</p>
        </div>
      </div>
    </body>
    </html>
  `,
};
exports.default = {
    sendEmail: exports.sendEmail,
    emailTemplates: exports.emailTemplates
};
//# sourceMappingURL=emailService.js.map