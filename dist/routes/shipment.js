"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const shipmentService_1 = require("../services/shipmentService");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
const createShipmentValidation = [
    (0, express_validator_1.body)('orderId').notEmpty().withMessage('Order ID is required'),
    (0, express_validator_1.body)('carrier').notEmpty().withMessage('Carrier is required'),
    (0, express_validator_1.body)('trackingNumber').notEmpty().withMessage('Tracking number is required'),
    (0, express_validator_1.body)('estimatedDelivery').optional().isISO8601().withMessage('Invalid estimated delivery date')
];
const updateShipmentValidation = [
    (0, express_validator_1.body)('status').optional().isIn(['PENDING', 'PREPARING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED']),
    (0, express_validator_1.body)('trackingNumber').optional().notEmpty().withMessage('Tracking number cannot be empty'),
    (0, express_validator_1.body)('carrier').optional().notEmpty().withMessage('Carrier cannot be empty'),
    (0, express_validator_1.body)('estimatedDelivery').optional().isISO8601().withMessage('Invalid estimated delivery date'),
    (0, express_validator_1.body)('actualDelivery').optional().isISO8601().withMessage('Invalid actual delivery date'),
    (0, express_validator_1.body)('notes').optional().isString().withMessage('Notes must be a string')
];
router.post('/create', auth_1.auth, auth_1.adminAuth, createShipmentValidation, async (req, res) => {
    try {
        const { orderId, address, parcels, selectedRateId, rateData } = req.body;
        const shipment = await (0, shipmentService_1.createShipment)({ orderId, toAddress: address, parcels }, selectedRateId, rateData);
        res.status(201).json({
            success: true,
            message: 'Shipment created successfully',
            data: { shipment }
        });
    }
    catch (error) {
        console.error('Create shipment error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.put('/:shipmentId/status', auth_1.auth, auth_1.adminAuth, updateShipmentValidation, async (req, res) => {
    try {
        const { shipmentId } = req.params;
        const shipment = await (0, shipmentService_1.getShipmentStatus)(shipmentId);
        res.json({
            success: true,
            message: 'Shipment status retrieved successfully',
            data: { shipment }
        });
    }
    catch (error) {
        console.error('Update shipment status error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.get('/track/:trackingNumber', auth_1.auth, async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        if (!trackingNumber) {
            res.status(400).json({
                success: false,
                message: 'Tracking number is required'
            });
            return;
        }
        const shipment = await prisma.order.findFirst({
            where: { trackingNumber },
            select: {
                trackingNumber: true,
                trackingUrl: true,
                shippingCarrier: true,
                shippingService: true,
                shipmentId: true,
                status: true,
            }
        });
        if (!shipment) {
            res.status(404).json({
                success: false,
                message: 'Tracking number not found'
            });
            return;
        }
        res.json({
            success: true,
            data: shipment
        });
    }
    catch (error) {
        console.error('Get tracking info error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.get('/', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: {
                    trackingNumber: { not: null }
                },
                select: {
                    id: true,
                    orderNumber: true,
                    trackingNumber: true,
                    trackingUrl: true,
                    shippingCarrier: true,
                    shippingService: true,
                    shipmentId: true,
                    status: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.order.count({
                where: {
                    trackingNumber: { not: null }
                }
            })
        ]);
        res.json({
            success: true,
            data: {
                shipments: orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('Get shipments error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.get('/analytics', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const [total, byCarrier, byStatus] = await Promise.all([
            prisma.order.count({ where: { trackingNumber: { not: null } } }),
            prisma.order.groupBy({
                by: ['shippingCarrier'],
                _count: true,
                where: { shippingCarrier: { not: null } }
            }),
            prisma.order.groupBy({
                by: ['status'],
                _count: true,
                where: { trackingNumber: { not: null } }
            })
        ]);
        res.json({
            success: true,
            data: {
                totalShipments: total,
                byCarrier,
                byStatus
            }
        });
    }
    catch (error) {
        console.error('Get shipment analytics error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.get('/:shipmentId', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { shipmentId } = req.params;
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: {
                order: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true
                            }
                        },
                        orderItems: {
                            include: {
                                product: {
                                    select: {
                                        name: true,
                                        image: true,
                                        price: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!shipment) {
            res.status(404).json({
                success: false,
                message: 'Shipment not found'
            });
            return;
        }
        res.json({
            success: true,
            data: { shipment }
        });
    }
    catch (error) {
        console.error('Get shipment error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
router.put('/bulk-update', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { shipments } = req.body;
        if (!Array.isArray(shipments)) {
            res.status(400).json({
                success: false,
                message: 'Shipments must be an array'
            });
            return;
        }
        const results = await Promise.allSettled(shipments.map(shipment => prisma.order.update({
            where: { id: shipment.orderId },
            data: { status: shipment.status }
        })));
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        res.json({
            success: true,
            message: `Bulk update completed: ${successful} successful, ${failed} failed`,
            data: {
                successful,
                failed
            }
        });
    }
    catch (error) {
        console.error('Bulk update shipments error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=shipment.js.map