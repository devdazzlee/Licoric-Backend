import express from 'express';
import { body } from 'express-validator';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Validation middleware
const discountValidation = [
  body('code').notEmpty().withMessage('Code is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('type').isIn(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']).withMessage('Invalid discount type'),
  body('value').isNumeric().withMessage('Value must be a number'),
  body('startDate').isISO8601().withMessage('Invalid start date'),
  body('endDate').isISO8601().withMessage('Invalid end date')
];

// @desc    Get all discounts (Admin)
// @route   GET /api/discounts
// @access  Private/Admin
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive as string;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.discount.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        discounts,
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
    console.error('Get discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Validate discount code (Public - for checkout)
// @route   POST /api/discounts/validate
// @access  Public
router.post('/validate', async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Discount code is required'
      });
    }

    const discount = await prisma.discount.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code'
      });
    }

    // Check if discount is active
    if (!discount.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This discount code is no longer active'
      });
    }

    // Check if discount has expired
    const now = new Date();
    if (now < discount.startDate || now > discount.endDate) {
      return res.status(400).json({
        success: false,
        message: 'This discount code has expired'
      });
    }

    // Check usage limit
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'This discount code has reached its usage limit'
      });
    }

    // Check minimum order amount
    if (discount.minimumAmount && orderAmount < Number(discount.minimumAmount)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${discount.minimumAmount} required for this discount`
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === 'PERCENTAGE') {
      discountAmount = (orderAmount * Number(discount.value)) / 100;
      if (discount.maximumDiscount && discountAmount > Number(discount.maximumDiscount)) {
        discountAmount = Number(discount.maximumDiscount);
      }
    } else if (discount.type === 'FIXED_AMOUNT') {
      discountAmount = Number(discount.value);
    }

    res.json({
      success: true,
      data: {
        discount: {
          code: discount.code,
          name: discount.name,
          type: discount.type,
          discountAmount
        }
      }
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create discount (Admin)
// @route   POST /api/discounts
// @access  Private/Admin
router.post('/', auth, adminAuth, discountValidation, async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      type,
      value,
      minimumAmount,
      maximumDiscount,
      usageLimit,
      startDate,
      endDate,
      isActive
    } = req.body;

    // Check if code already exists
    const existingDiscount = await prisma.discount.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existingDiscount) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists'
      });
    }

    const discount = await prisma.discount.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        value,
        minimumAmount,
        maximumDiscount,
        usageLimit,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      data: { discount }
    });
  } catch (error) {
    console.error('Create discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update discount (Admin)
// @route   PUT /api/discounts/:id
// @access  Private/Admin
router.put('/:id', auth, adminAuth, discountValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      type,
      value,
      minimumAmount,
      maximumDiscount,
      usageLimit,
      startDate,
      endDate,
      isActive
    } = req.body;

    const discount = await prisma.discount.findUnique({
      where: { id }
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Check if code is taken by another discount
    if (code.toUpperCase() !== discount.code) {
      const existingDiscount = await prisma.discount.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (existingDiscount) {
        return res.status(400).json({
          success: false,
          message: 'Discount code already exists'
        });
      }
    }

    const updatedDiscount = await prisma.discount.update({
      where: { id },
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        value,
        minimumAmount,
        maximumDiscount,
        usageLimit,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive
      }
    });

    res.json({
      success: true,
      message: 'Discount updated successfully',
      data: { discount: updatedDiscount }
    });
  } catch (error) {
    console.error('Update discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete discount (Admin)
// @route   DELETE /api/discounts/:id
// @access  Private/Admin
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await prisma.discount.findUnique({
      where: { id }
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    await prisma.discount.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;







