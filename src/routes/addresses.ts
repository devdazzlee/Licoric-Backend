
import express from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Validation middleware
const addressValidation = [
  body('label').notEmpty().withMessage('Label is required'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('Zip code is required'),
  body('country').optional(),
  body('phone').optional(),
  body('isDefault').optional().isBoolean()
];

// All routes require authentication
router.use(auth);

// @desc    Get all user addresses
// @route   GET /api/addresses
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: { addresses }
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single address
// @route   GET /api/addresses/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const address = await prisma.address.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.json({
      success: true,
      data: { address }
    });
  } catch (error) {
    console.error('Get address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new address
// @route   POST /api/addresses
// @access  Private
router.post('/', addressValidation, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      label,
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
      isDefault
    } = req.body;

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    // If this is the first address, make it default
    const addressCount = await prisma.address.count({
      where: { userId }
    });

    const newAddress = await prisma.address.create({
      data: {
        userId,
        label,
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        zipCode,
        country: country || 'USA',
        isDefault: isDefault || addressCount === 0
      }
    });

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: { address: newAddress }
    });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
router.put('/:id', addressValidation, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const {
      label,
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
      isDefault
    } = req.body;

    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    if (isDefault && !existingAddress.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        label,
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        isDefault
      }
    });

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: { address: updatedAddress }
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Set address as default
// @route   PATCH /api/addresses/:id/default
// @access  Private
router.patch('/:id/default', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const address = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: { isDefault: true }
    });

    res.json({
      success: true,
      message: 'Default address updated',
      data: { address: updatedAddress }
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const address = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    await prisma.address.delete({
      where: { id }
    });

    if (address.isDefault) {
      const firstAddress = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      });

      if (firstAddress) {
        await prisma.address.update({
          where: { id: firstAddress.id },
          data: { isDefault: true }
        });
      }
    }

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;