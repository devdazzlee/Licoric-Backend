import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { sendEmail } from './emailService';

interface InvoiceData {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

export const generateInvoice = async (invoiceData: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc
        .fontSize(20)
        .fillColor('#E85A2D')
        .text('SOUTHERN SWEET AND SOUR', 50, 50)
        .fontSize(10)
        .fillColor('#666')
        .text('4363 Ocean Farm Dr', 50, 75)
        .text('Summerville, SC 29485', 50, 88)
        .text('Phone: +1 919-701-9321', 50, 101)
        .text('Email: Info@southernsweetandsour.com', 50, 114);

      // Invoice title
      doc
        .fontSize(25)
        .fillColor('#000')
        .text('INVOICE', 400, 50, { align: 'right' })
        .fontSize(10)
        .fillColor('#666')
        .text(`Invoice #: ${invoiceData.orderNumber}`, 400, 80, { align: 'right' })
        .text(`Date: ${invoiceData.orderDate}`, 400, 95, { align: 'right' });

      // Customer info
      doc
        .fontSize(12)
        .fillColor('#000')
        .text('Bill To:', 50, 160)
        .fontSize(10)
        .fillColor('#666')
        .text(invoiceData.customerName, 50, 180)
        .text(invoiceData.customerEmail, 50, 195)
        .text(invoiceData.shippingAddress.address, 50, 210)
        .text(
          `${invoiceData.shippingAddress.city}, ${invoiceData.shippingAddress.state} ${invoiceData.shippingAddress.zipCode}`,
          50,
          225
        )
        .text(invoiceData.shippingAddress.country, 50, 240);

      // Table header
      const tableTop = 290;
      doc
        .fontSize(10)
        .fillColor('#fff')
        .rect(50, tableTop, 515, 25)
        .fill('#E85A2D')
        .fillColor('#fff')
        .text('Item', 60, tableTop + 8)
        .text('Qty', 320, tableTop + 8)
        .text('Price', 380, tableTop + 8)
        .text('Total', 480, tableTop + 8, { align: 'right' });

      // Table rows
      let yPosition = tableTop + 35;
      doc.fillColor('#000');

      invoiceData.items.forEach((item, index) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        const bgColor = index % 2 === 0 ? '#f9f9f9' : '#fff';
        doc
          .rect(50, yPosition - 5, 515, 25)
          .fill(bgColor)
          .fillColor('#000')
          .fontSize(9)
          .text(item.name, 60, yPosition, { width: 250 })
          .text(item.quantity.toString(), 320, yPosition)
          .text(`$${item.price.toFixed(2)}`, 380, yPosition)
          .text(`$${item.total.toFixed(2)}`, 480, yPosition, { align: 'right' });

        yPosition += 25;
      });

      // Totals
      yPosition += 20;
      const totalsX = 400;

      doc
        .fontSize(10)
        .text('Subtotal:', totalsX, yPosition)
        .text(`$${invoiceData.subtotal.toFixed(2)}`, 480, yPosition, { align: 'right' });

      yPosition += 20;
      doc
        .text('Shipping:', totalsX, yPosition)
        .text(`$${invoiceData.shipping.toFixed(2)}`, 480, yPosition, { align: 'right' });

      yPosition += 20;
      doc
        .text('Tax:', totalsX, yPosition)
        .text(`$${invoiceData.tax.toFixed(2)}`, 480, yPosition, { align: 'right' });

      if (invoiceData.discount > 0) {
        yPosition += 20;
        doc
          .fillColor('#28a745')
          .text('Discount:', totalsX, yPosition)
          .text(`-$${invoiceData.discount.toFixed(2)}`, 480, yPosition, { align: 'right' });
      }

      yPosition += 25;
      doc
        .fontSize(12)
        .fillColor('#E85A2D')
        .text('Total:', totalsX, yPosition)
        .text(`$${invoiceData.total.toFixed(2)}`, 480, yPosition, { align: 'right' });

      // Footer
      doc
        .fontSize(8)
        .fillColor('#999')
        .text(
          'Thank you for your business!',
          50,
          750,
          { align: 'center', width: 515 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Email invoice
export const emailInvoice = async (email: string, invoiceBuffer: Buffer, orderNumber: string) => {
  try {
    await sendEmail({
      to: email,
      subject: `Invoice for Order #${orderNumber}`,
      html: `
        <h2>Your Invoice</h2>
        <p>Please find attached your invoice for order #${orderNumber}.</p>
        <p>Thank you for your purchase!</p>
      `,
      attachments: [
        {
          filename: `invoice-${orderNumber}.pdf`,
          content: invoiceBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
    return { success: true };
  } catch (error) {
    console.error('Email invoice error:', error);
    return { success: false, error };
  }
};
