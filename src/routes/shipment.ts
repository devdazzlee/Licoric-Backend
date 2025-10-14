import express from 'express';
import { body } from 'express-validator';
import { validateAddress, getShippingRates, createShipment, getShipmentStatus } from '../services/shipmentService';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';

const prisma = new PrismaClient();
const router = express.Router();

// Validation middleware
const createShipmentValidation = [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('carrier').notEmpty().withMessage('Carrier is required'),
  body('trackingNumber').notEmpty().withMessage('Tracking number is required'),
  body('estimatedDelivery').optional().isISO8601().withMessage('Invalid estimated delivery date')
];

const updateShipmentValidation = [
  body('status').optional().isIn(['PENDING', 'PREPARING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED']),
  body('trackingNumber').optional().notEmpty().withMessage('Tracking number cannot be empty'),
  body('carrier').optional().notEmpty().withMessage('Carrier cannot be empty'),
  body('estimatedDelivery').optional().isISO8601().withMessage('Invalid estimated delivery date'),
  body('actualDelivery').optional().isISO8601().withMessage('Invalid actual delivery date'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// @desc    Create shipment
// @route   POST /api/shipment/create
// @access  Private/Admin
router.post('/create', auth, adminAuth, createShipmentValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, address, parcels, selectedRateId, rateData } = req.body;

    const shipment = await createShipment(
      { orderId, toAddress: address, parcels },
      selectedRateId,
      rateData
    );

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully',
      data: { shipment }
    });
  } catch (error) {
    console.error('Create shipment error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Update shipment status
// @route   PUT /api/shipment/:shipmentId/status
// @access  Private/Admin
router.put('/:shipmentId/status', auth, adminAuth, updateShipmentValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { shipmentId } = req.params;

    const shipment = await getShipmentStatus(shipmentId);

    res.json({
      success: true,
      message: 'Shipment status retrieved successfully',
      data: { shipment }
    });
  } catch (error) {
    console.error('Update shipment status error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Get tracking information
// @route   GET /api/shipment/track/:trackingNumber
// @access  Private
router.get('/track/:trackingNumber', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error) {
    console.error('Get tracking info error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Get all shipments
// @route   GET /api/shipment
// @access  Private/Admin
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

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
        take: parseInt(limit as string)
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
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Get shipment analytics
// @route   GET /api/shipment/analytics
// @access  Private/Admin
router.get('/analytics', auth, adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error) {
    console.error('Get shipment analytics error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Get shipment by ID
// @route   GET /api/shipment/:shipmentId
// @access  Private/Admin
router.get('/:shipmentId', auth, adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

// @desc    Bulk update shipments
// @route   PUT /api/shipment/bulk-update
// @access  Private/Admin
router.put('/bulk-update', auth, adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { shipments } = req.body; // Array of { orderId, status }

    if (!Array.isArray(shipments)) {
      res.status(400).json({
        success: false,
        message: 'Shipments must be an array'
      });
      return;
    }

    const results = await Promise.allSettled(
      shipments.map(shipment => 
        prisma.order.update({
          where: { id: shipment.orderId },
          data: { status: shipment.status }
        })
      )
    );

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
  } catch (error) {
    console.error('Bulk update shipments error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
});

export default router;
