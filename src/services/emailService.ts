import nodemailer from 'nodemailer';

// Check if email is configured
const isEmailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

// Create reusable transporter
const transporter = isEmailConfigured ? nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
}) : null;

// Verify connection only if configured
if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.log('❌ Email service error:', error);
    } else {
      console.log('✅ Email service ready');
    }
  });
} else {
  console.log('⚠️  Email service not configured (EMAIL_USER and EMAIL_PASSWORD missing)');
  console.log('   Emails will be logged to console instead');
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}

// Send email
export const sendEmail = async (options: EmailOptions) => {
  // If email not configured, just log instead
  if (!transporter) {
    console.log('📧 Email would be sent (not configured):');
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    return { success: true, messageId: 'mock-email-id' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Southern Sweet and Sour'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, error };
  }
};

// Email templates
export const emailTemplates = {
  // Welcome email
  welcome: (name: string) => `
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
          <h1>Welcome to Southern Sweet and Sour!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name}!</h2>
          <p>Thank you for joining Southern Sweet and Sour! We're excited to have you as part of our community.</p>
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

  // Order confirmation
  orderConfirmation: (orderData: any) => `
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
        .button { 
          display: inline-block;
          padding: 12px 30px;
          background: #E85A2D;
          color: white !important;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
        }
        .shipping-box {
          background: #E3F2FD;
          border-left: 4px solid #2196F3;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .tracking-number {
          font-family: monospace;
          font-size: 16px;
          background: #f5f5f5;
          padding: 8px 12px;
          border-radius: 4px;
          display: inline-block;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Thank you for your order!</h2>
          <p>Hi ${orderData.customerName},</p>
          <p>Your order has been confirmed and is being processed. We'll ship it out soon!</p>
          
          <div class="order-info">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
            <p><strong>Order Date:</strong> ${orderData.orderDate}</p>
            <p><strong>Status:</strong> ${orderData.status}</p>
            
            <h4>Items:</h4>
            ${orderData.items.map((item: any) => `
              <div class="item">
                <strong>${item.name}</strong> x ${item.quantity}<br>
                Price: $${item.price}
              </div>
            `).join('')}
            
            <p class="total">Total: $${orderData.total}</p>
          </div>

          ${orderData.shippingDetails?.trackingNumber ? `
            <div class="shipping-box">
              <h3 style="margin-top: 0; color: #1976D2;">📦 Shipping Information</h3>
              <p><strong>Carrier:</strong> ${orderData.shippingDetails.carrier} ${orderData.shippingDetails.service ? `(${orderData.shippingDetails.service})` : ''}</p>
              <p><strong>Tracking Number:</strong><br>
              <span class="tracking-number">${orderData.shippingDetails.trackingNumber}</span></p>
              ${orderData.shippingDetails.shippingCost ? `<p><strong>Shipping Cost:</strong> $${orderData.shippingDetails.shippingCost}</p>` : ''}
              <p style="text-align: center; margin-top: 20px;">
                <a href="${orderData.shippingDetails.trackingUrl}" class="button" style="background: #2196F3;">
                  🚚 Track Your Package
                </a>
              </p>
            </div>
          ` : `
            <div class="shipping-box">
              <h3 style="margin-top: 0; color: #1976D2;">📦 Shipping Information</h3>
              <p>Your shipping label is being created. You'll receive a tracking number within 24 hours.</p>
            </div>
          `}
          
          <p><strong>Shipping Address:</strong><br>
          ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
          ${orderData.shippingAddress.address}<br>
          ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}
          </p>
          
          <p style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
            Questions? Contact us at Info@southernsweetandsour.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Shipping notification
  shippingNotification: (shipmentData: any) => `
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

  // Wholesale inquiry notification (to admin)
  wholesaleInquiry: (inquiryData: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #E85A2D; }
        .highlight { background: #FFF3CD; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .button { background: #E85A2D; color: white; padding: 12px 30px; text-decoration: none; display: inline-block; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏢 New Wholesale Inquiry</h1>
        </div>
        <div class="content">
          <h2>Wholesale Inquiry</h2>
          <div class="info-box">
            <p><strong>First Name:</strong> ${inquiryData.FirstName}</p>
            <p><strong>Last Name:</strong> ${inquiryData.LastName}</p>
            <p><strong>Email:</strong> ${inquiryData.email}</p>
            <p><strong>Phone:</strong> ${inquiryData.phone}</p>
            <p><strong>Message:</strong> ${inquiryData.message}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Wholesale inquiry confirmation (to customer)
  wholesaleConfirmation: (customerData: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .highlight { background: #E3F2FD; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3; }
        .contact-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Wholesale Inquiry Received</h1>
        </div>
        <div class="content">
          <h2>Thank you for your interest!</h2>
          <p>Hi ${customerData.FirstName} ${customerData.LastName},</p>
          <p>Thank you for reaching out to us regarding wholesale opportunities.</p>
          
          <div class="highlight">
            <h3 style="margin-top: 0; color: #1976D2;">What happens next?</h3>
            <ul>
              <li>Our wholesale team will review your inquiry within 24 hours</li>
              <li>We'll contact you with competitive pricing and terms</li>
              <li>We'll discuss your specific needs and requirements</li>
              <li>We'll provide samples if requested</li>
            </ul>
          </div>

          <div class="contact-info">
            <h3>Our Wholesale Team</h3>
            <p><strong>Email:</strong> ${customerData.email}</p>
            <p><strong>Phone:</strong> ${customerData.phone}</p>
            <p><strong>Business Hours:</strong> Monday - Friday, 9AM - 5PM EST</p>
          </div>

          <p>We look forward to partnering with you!</p>
          <p><strong>The Southern Sweet and Sour Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Return/Refund approved
  refundApproved: (refundData: any) => `
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

  // Contact form notification (to admin)
  contactFormNotification: (contactData: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #E85A2D; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 New Contact Form Submission</h1>
        </div>
        <div class="content">
          <div class="info-box">
            <p><strong>Name:</strong> ${contactData.name}</p>
            <p><strong>Email:</strong> ${contactData.email}</p>
            <p><strong>Phone:</strong> ${contactData.phone || 'N/A'}</p>
            <p><strong>Subject:</strong> ${contactData.subject}</p>
            <p><strong>Message:</strong></p>
            <p>${contactData.message}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Contact form confirmation (to customer)
  contactFormConfirmation: (customerData: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Message Received</h1>
        </div>
        <div class="content">
          <h2>Thank you for contacting us!</h2>
          <p>Hi ${customerData.name},</p>
          <p>We've received your message and will get back to you within 24 hours.</p>
          <p><strong>The Southern Sweet and Sour Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Newsletter subscription notification (to admin)
  newsletterSubscriptionNotification: (subscriberData: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📰 New Newsletter Subscriber</h1>
        </div>
        <div class="content">
          <p><strong>Email:</strong> ${subscriberData.email}</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Newsletter subscription confirmation (to customer)
  newsletterConfirmation: (email: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #E85A2D; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Successfully Subscribed!</h1>
        </div>
        <div class="content">
          <h2>Thank you for subscribing!</h2>
          <p>Hi there,</p>
          <p>You've been successfully subscribed to our newsletter. You'll receive updates on new products, special offers, and more!</p>
          <p><strong>The Southern Sweet and Sour Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `,
};

export default {
  sendEmail,
  emailTemplates
};
