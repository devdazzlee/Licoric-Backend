import express from 'express';
import { body } from 'express-validator';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Validation middleware
const flavorValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').optional(),
  body('color').optional(),
  body('image').optional(),
  body('isActive').optional().isBoolean()
];

// @desc    Get all flavors (Public)
// @route   GET /api/flavors
// @access  Public
router.get('/', async (req, res) => {
  try {
    const isActive = req.query.isActive as string;
    
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const flavors = await prisma.flavor.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { flavors }
    });
  } catch (error) {
    console.error('Get flavors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single flavor
// @route   GET /api/flavors/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          take: 10,
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            rating: true
          }
        }
      }
    });

    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: 'Flavor not found'
      });
    }

    res.json({
      success: true,
      data: { flavor }
    });
  } catch (error) {
    console.error('Get flavor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create flavor (Admin)
// @route   POST /api/flavors
// @access  Private/Admin
router.post('/', auth, adminAuth, flavorValidation, async (req, res) => {
  try {
    const { name, description, color, image, isActive } = req.body;

    // Check if flavor name already exists
    const existingFlavor = await prisma.flavor.findUnique({
      where: { name }
    });

    if (existingFlavor) {
      return res.status(400).json({
        success: false,
        message: 'Flavor with this name already exists'
      });
    }

    const flavor = await prisma.flavor.create({
      data: {
        name,
        description,
        color,
        image,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Flavor created successfully',
      data: { flavor }
    });
  } catch (error) {
    console.error('Create flavor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update flavor (Admin)
// @route   PUT /api/flavors/:id
// @access  Private/Admin
router.put('/:id', auth, adminAuth, flavorValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, image, isActive } = req.body;

    const flavor = await prisma.flavor.findUnique({
      where: { id }
    });

    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: 'Flavor not found'
      });
    }

    // Check if name is taken by another flavor
    if (name !== flavor.name) {
      const existingFlavor = await prisma.flavor.findUnique({
        where: { name }
      });

      if (existingFlavor) {
        return res.status(400).json({
          success: false,
          message: 'Flavor with this name already exists'
        });
      }
    }

    const updatedFlavor = await prisma.flavor.update({
      where: { id },
      data: {
        name,
        description,
        color,
        image,
        isActive
      }
    });

    res.json({
      success: true,
      message: 'Flavor updated successfully',
      data: { flavor: updatedFlavor }
    });
  } catch (error) {
    console.error('Update flavor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete flavor (Admin)
// @route   DELETE /api/flavors/:id
// @access  Private/Admin
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: 'Flavor not found'
      });
    }

    // Check if flavor has products
    if (flavor._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete flavor. It is currently used by ${flavor._count.products} product(s)`
      });
    }

    await prisma.flavor.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Flavor deleted successfully'
    });
  } catch (error) {
    console.error('Delete flavor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Assign flavor to product (Admin)
// @route   POST /api/flavors/:flavorId/products/:productId
// @access  Private/Admin
router.post('/:flavorId/products/:productId', auth, adminAuth, async (req, res) => {
  try {
    const { flavorId, productId } = req.params;

    const flavor = await prisma.flavor.findUnique({
      where: { id: flavorId }
    });

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!flavor) {
      return res.status(404).json({
        success: false,
        message: 'Flavor not found'
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update product to include this flavor
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        flavors: {
          connect: { id: flavorId }
        }
      },
      include: {
        flavors: true
      }
    });

    res.json({
      success: true,
      message: 'Flavor assigned to product successfully',
      data: { product: updatedProduct }
    });
  } catch (error) {
    console.error('Assign flavor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Remove flavor from product (Admin)
// @route   DELETE /api/flavors/:flavorId/products/:productId
// @access  Private/Admin
router.delete('/:flavorId/products/:productId', auth, adminAuth, async (req, res) => {
  try {
    const { flavorId, productId } = req.params;

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        flavors: {
          disconnect: { id: flavorId }
        }
      },
      include: {
        flavors: true
      }
    });

    res.json({
      success: true,
      message: 'Flavor removed from product successfully',
      data: { product: updatedProduct }
    });
  } catch (error) {
    console.error('Remove flavor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
