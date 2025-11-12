"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const invoiceService_1 = require("../services/invoiceService");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
router.get('/order/:orderId', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user.id;
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
        const pdfBuffer = await (0, invoiceService_1.generateInvoice)(invoiceData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invoice'
        });
    }
});
router.post('/order/:orderId/email', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user.id;
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
        const pdfBuffer = await (0, invoiceService_1.generateInvoice)(invoiceData);
        await (0, invoiceService_1.emailInvoice)(order.user.email, pdfBuffer, order.orderNumber);
        res.json({
            success: true,
            message: 'Invoice sent to your email'
        });
    }
    catch (error) {
        console.error('Email invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to email invoice'
        });
    }
});
router.get('/admin/order/:orderId', auth_1.auth, auth_1.adminAuth, async (req, res) => {
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
        const pdfBuffer = await (0, invoiceService_1.generateInvoice)(invoiceData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error('Admin generate invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invoice'
        });
    }
});
exports.default = router;
//# sourceMappingURL=invoices.js.map