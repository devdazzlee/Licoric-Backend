import express from 'express';
import { body } from 'express-validator';
import { auth, adminAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// All routes require admin auth
router.use(auth, adminAuth);

// @desc    Get all inventory logs
// @route   GET /api/inventory/logs
// @access  Private/Admin
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const productId = req.query.productId as string;
    const type = req.query.type as string;

    const where: any = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              image: true,
              sku: true,
              stock: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.inventoryLog.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        logs,
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
    console.error('Get inventory logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create inventory log (stock adjustment)
// @route   POST /api/inventory/adjust
// @access  Private/Admin
router.post('/adjust', [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('type').isIn(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'EXPIRED']).withMessage('Invalid log type'),
  body('quantity').isInt().withMessage('Quantity must be an integer'),
  body('reason').optional(),
  body('notes').optional()
], async (req, res) => {
  try {
    const { productId, type, quantity, reason, notes, referenceId } = req.body;

    // Get current product
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Calculate new stock
    let stockChange = quantity;
    if (type === 'STOCK_OUT' || type === 'DAMAGE' || type === 'EXPIRED') {
      stockChange = -Math.abs(quantity);
    } else {
      stockChange = Math.abs(quantity);
    }

    const newStock = product.stock + stockChange;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for this operation'
      });
    }

    // Create log and update stock in transaction
    const [log, updatedProduct] = await prisma.$transaction([
      prisma.inventoryLog.create({
        data: {
          productId,
          type,
          quantity: stockChange,
          reason,
          notes,
          referenceId
        }
      }),
      prisma.product.update({
        where: { id: productId },
        data: { stock: newStock }
      })
    ]);

    res.status(201).json({
      success: true,
      message: 'Inventory adjusted successfully',
      data: {
        log,
        product: updatedProduct
      }
    });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get low stock products
// @route   GET /api/inventory/low-stock
// @access  Private/Admin
router.get('/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold as string) || 10;

    const products = await prisma.product.findMany({
      where: {
        stock: { lte: threshold },
        isActive: true
      },
      orderBy: { stock: 'asc' },
      select: {
        id: true,
        name: true,
        image: true,
        sku: true,
        stock: true,
        price: true,
        category: true
      }
    });

    res.json({
      success: true,
      data: { products, threshold }
    });
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get inventory summary
// @route   GET /api/inventory/summary
// @access  Private/Admin
router.get('/summary', async (req, res) => {
  try {
    const [totalProducts, lowStockProducts, outOfStockProducts, totalStockValue] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { stock: { lte: 10 }, isActive: true } }),
      prisma.product.count({ where: { stock: 0, isActive: true } }),
      prisma.product.aggregate({
        where: { isActive: true },
        _sum: { stock: true }
      })
    ]);

    const recentLogs = await prisma.inventoryLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          lowStockProducts,
          outOfStockProducts,
          totalStock: totalStockValue._sum.stock || 0
        },
        recentLogs
      }
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;







