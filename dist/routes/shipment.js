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
        const { orderId, carrier, trackingNumber, estimatedDelivery } = req.body;
        const shipment = await shipmentService_1.ShipmentService.createShipment({
            orderId,
            carrier,
            trackingNumber,
            ...(estimatedDelivery && { estimatedDelivery: new Date(estimatedDelivery) })
        });
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
        const updateData = req.body;
        if (updateData.estimatedDelivery) {
            updateData.estimatedDelivery = new Date(updateData.estimatedDelivery);
        }
        if (updateData.actualDelivery) {
            updateData.actualDelivery = new Date(updateData.actualDelivery);
        }
        const shipment = await shipmentService_1.ShipmentService.updateShipmentStatus(shipmentId, updateData);
        res.json({
            success: true,
            message: 'Shipment status updated successfully',
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
        const trackingInfo = await shipmentService_1.ShipmentService.getTrackingInfo(trackingNumber);
        res.json({
            success: true,
            data: trackingInfo
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
        const { status, carrier, page = 1, limit = 10 } = req.query;
        const filters = {
            status: status,
            carrier: carrier,
            page: parseInt(page),
            limit: parseInt(limit)
        };
        const result = await shipmentService_1.ShipmentService.getShipments(filters);
        res.json({
            success: true,
            data: result
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
        const analytics = await shipmentService_1.ShipmentService.getShipmentAnalytics();
        res.json({
            success: true,
            data: analytics
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
        const results = await Promise.allSettled(shipments.map(shipment => shipmentService_1.ShipmentService.updateShipmentStatus(shipment.id, {
            status: shipment.status,
            notes: shipment.notes
        })));
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        res.json({
            success: true,
            message: `Bulk update completed: ${successful} successful, ${failed} failed`,
            data: {
                successful,
                failed,
                results
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