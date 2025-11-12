import express from 'express';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { generateInvoice, emailInvoice } from '../services/invoiceService';

const prisma = new PrismaClient();
const router = express.Router();

// @desc    Download invoice for order
// @route   GET /api/invoices/order/:orderId
// @access  Private
router.get('/order/:orderId', auth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { orderId } = req.params;

    // Get order with all details
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId // Ensure user owns this order
      },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Prepare invoice data
    const invoiceData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerEmail: order.user.email,
      shippingAddress: {
        address: order.shippingAddress,
        city: order.shippingCity,
        state: order.shippingState,
        zipCode: order.shippingZipCode,
        country: order.shippingCountry
      },
      items: order.orderItems.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.price) * item.quantity
      })),
      subtotal: Number(order.totalAmount) - Number(order.shippingAmount) - Number(order.taxAmount) + Number(order.discountAmount),
      shipping: Number(order.shippingAmount),
      tax: Number(order.taxAmount),
      discount: Number(order.discountAmount),
      total: Number(order.totalAmount)
    };

    // Generate PDF
    const pdfBuffer = await generateInvoice(invoiceData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
});

// @desc    Email invoice to customer
// @route   POST /api/invoices/order/:orderId/email
// @access  Private
router.post('/order/:orderId/email', auth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Prepare invoice data (same as above)
    const invoiceData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerEmail: order.user.email,
      shippingAddress: {
        address: order.shippingAddress,
        city: order.shippingCity,
        state: order.shippingState,
        zipCode: order.shippingZipCode,
        country: order.shippingCountry
      },
      items: order.orderItems.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.price) * item.quantity
      })),
      subtotal: Number(order.totalAmount) - Number(order.shippingAmount) - Number(order.taxAmount) + Number(order.discountAmount),
      shipping: Number(order.shippingAmount),
      tax: Number(order.taxAmount),
      discount: Number(order.discountAmount),
      total: Number(order.totalAmount)
    };

    // Generate PDF
    const pdfBuffer = await generateInvoice(invoiceData);

    // Email invoice
    await emailInvoice(order.user.email, pdfBuffer, order.orderNumber);

    res.json({
      success: true,
      message: 'Invoice sent to your email'
    });
  } catch (error) {
    console.error('Email invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to email invoice'
    });
  }
});

// @desc    Download invoice for any order (Admin)
// @route   GET /api/invoices/admin/order/:orderId
// @access  Private/Admin
router.get('/admin/order/:orderId', auth, adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const invoiceData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerEmail: order.user.email,
      shippingAddress: {
        address: order.shippingAddress,
        city: order.shippingCity,
        state: order.shippingState,
        zipCode: order.shippingZipCode,
        country: order.shippingCountry
      },
      items: order.orderItems.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.price) * item.quantity
      })),
      subtotal: Number(order.totalAmount) - Number(order.shippingAmount) - Number(order.taxAmount) + Number(order.discountAmount),
      shipping: Number(order.shippingAmount),
      tax: Number(order.taxAmount),
      discount: Number(order.discountAmount),
      total: Number(order.totalAmount)
    };

    const pdfBuffer = await generateInvoice(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Admin generate invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
});

export default router;







