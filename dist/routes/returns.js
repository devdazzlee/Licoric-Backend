"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const emailService_1 = require("../services/emailService");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
router.post('/', auth_1.auth, [
    (0, express_validator_1.body)('orderId').notEmpty().withMessage('Order ID is required'),
    (0, express_validator_1.body)('reason').notEmpty().withMessage('Reason is required'),
    (0, express_validator_1.body)('description').optional(),
    (0, express_validator_1.body)('images').optional().isArray()
], async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId, reason, description, images } = req.body;
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId,
                status: 'DELIVERED'
            },
            include: {
                user: true
            }
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or not eligible for return'
            });
        }
        const existingReturn = await prisma.returnRequest.findFirst({
            where: { orderId }
        });
        if (existingReturn) {
            return res.status(400).json({
                success: false,
                message: 'Return request already exists for this order'
            });
        }
        const returnRequest = await prisma.returnRequest.create({
            data: {
                orderId,
                userId,
                reason,
                description,
                refundAmount: order.totalAmount,
                images: images || []
            }
        });
        res.status(201).json({
            success: true,
            message: 'Return request submitted successfully',
            data: { returnRequest }
        });
    }
    catch (error) {
        console.error('Create return request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const returns = await prisma.returnRequest.findMany({
            where: { userId },
            include: {
                order: {
                    select: {
                        orderNumber: true,
                        totalAmount: true,
                        createdAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: { returns }
        });
    }
    catch (error) {
        console.error('Get returns error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/:id', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const returnRequest = await prisma.returnRequest.findFirst({
            where: {
                id,
                userId
            },
            include: {
                order: {
                    include: {
                        orderItems: {
                            include: {
                                product: true
                            }
                        }
                    }
                }
            }
        });
        if (!returnRequest) {
            return res.status(404).json({
                success: false,
                message: 'Return request not found'
            });
        }
        res.json({
            success: true,
            data: { returnRequest }
        });
    }
    catch (error) {
        console.error('Get return request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.delete('/:id', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const returnRequest = await prisma.returnRequest.findFirst({
            where: {
                id,
                userId,
                status: 'PENDING'
            }
        });
        if (!returnRequest) {
            return res.status(404).json({
                success: false,
                message: 'Return request not found or cannot be cancelled'
            });
        }
        await prisma.returnRequest.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
        res.json({
            success: true,
            message: 'Return request cancelled'
        });
    }
    catch (error) {
        console.error('Cancel return request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/admin/all', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = {};
        if (status)
            where.status = status;
        const [returns, total] = await Promise.all([
            prisma.returnRequest.findMany({
                where,
                include: {
                    order: {
                        select: {
                            orderNumber: true,
                            totalAmount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.returnRequest.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                returns,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });
    }
    catch (error) {
        console.error('Get all returns error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/admin/:id/process', auth_1.auth, auth_1.adminAuth, [
    (0, express_validator_1.body)('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
    (0, express_validator_1.body)('adminNotes').optional()
], async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes, refundMethod } = req.body;
        const adminId = req.user.id;
        const returnRequest = await prisma.returnRequest.findUnique({
            where: { id },
            include: {
                order: {
                    include: {
                        user: true
                    }
                }
            }
        });
        if (!returnRequest) {
            return res.status(404).json({
                success: false,
                message: 'Return request not found'
            });
        }
        const updated = await prisma.returnRequest.update({
            where: { id },
            data: {
                status,
                adminNotes,
                refundMethod: refundMethod || 'original_payment',
                processedBy: adminId,
                processedAt: new Date()
            }
        });
        if (status === 'APPROVED') {
            await prisma.order.update({
                where: { id: returnRequest.orderId },
                data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' }
            });
            await (0, emailService_1.sendEmail)({
                to: returnRequest.order.user.email,
                subject: 'Your Return Has Been Approved',
                html: emailService_1.emailTemplates.refundApproved({
                    customerName: `${returnRequest.order.user.firstName} ${returnRequest.order.user.lastName}`,
                    orderNumber: returnRequest.order.orderNumber,
                    refundAmount: Number(returnRequest.refundAmount).toFixed(2)
                })
            });
        }
        res.json({
            success: true,
            message: `Return request ${status.toLowerCase()}`,
            data: { returnRequest: updated }
        });
    }
    catch (error) {
        console.error('Process return error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=returns.js.map