import express from 'express';
import { body } from 'express-validator';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { sendEmail, emailTemplates } from '../services/emailService';

const prisma = new PrismaClient();
const router = express.Router();

// @desc    Create return request
// @route   POST /api/returns
// @access  Private
router.post('/', auth, [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('description').optional(),
  body('images').optional().isArray()
], async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { orderId, reason, description, images } = req.body;

    // Verify order belongs to user and is eligible for return
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: 'DELIVERED' // Only delivered orders can be returned
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

    // Check if return request already exists
    const existingReturn = await prisma.returnRequest.findFirst({
      where: { orderId }
    });

    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: 'Return request already exists for this order'
      });
    }

    // Create return request
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
  } catch (error) {
    console.error('Create return request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get user's return requests
// @route   GET /api/returns
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

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
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single return request
// @route   GET /api/returns/:id
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
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
  } catch (error) {
    console.error('Get return request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Cancel return request
// @route   DELETE /api/returns/:id
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const returnRequest = await prisma.returnRequest.findFirst({
      where: {
        id,
        userId,
        status: 'PENDING' // Can only cancel pending requests
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
  } catch (error) {
    console.error('Cancel return request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ===== ADMIN ROUTES =====

// @desc    Get all return requests (Admin)
// @route   GET /api/returns/admin/all
// @access  Private/Admin
router.get('/admin/all', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = {};
    if (status) where.status = status;

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
  } catch (error) {
    console.error('Get all returns error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Process return request (Approve/Reject)
// @route   PUT /api/returns/admin/:id/process
// @access  Private/Admin
router.put('/admin/:id/process', auth, adminAuth, [
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
  body('adminNotes').optional()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, refundMethod } = req.body;
    const adminId = (req as any).user.id;

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

    // Update return request
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

    // If approved, update order status to REFUNDED
    if (status === 'APPROVED') {
      await prisma.order.update({
        where: { id: returnRequest.orderId },
        data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' }
      });

      // Send approval email
      await sendEmail({
        to: returnRequest.order.user.email,
        subject: 'Your Return Has Been Approved',
        html: emailTemplates.refundApproved({
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
  } catch (error) {
    console.error('Process return error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;







