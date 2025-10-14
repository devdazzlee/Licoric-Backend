"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
router.use(auth_1.auth, auth_1.adminAuth);
router.get('/logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const productId = req.query.productId;
        const type = req.query.type;
        const where = {};
        if (productId)
            where.productId = productId;
        if (type)
            where.type = type;
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
    }
    catch (error) {
        console.error('Get inventory logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/adjust', [
    (0, express_validator_1.body)('productId').notEmpty().withMessage('Product ID is required'),
    (0, express_validator_1.body)('type').isIn(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'EXPIRED']).withMessage('Invalid log type'),
    (0, express_validator_1.body)('quantity').isInt().withMessage('Quantity must be an integer'),
    (0, express_validator_1.body)('reason').optional(),
    (0, express_validator_1.body)('notes').optional()
], async (req, res) => {
    try {
        const { productId, type, quantity, reason, notes, referenceId } = req.body;
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        let stockChange = quantity;
        if (type === 'STOCK_OUT' || type === 'DAMAGE' || type === 'EXPIRED') {
            stockChange = -Math.abs(quantity);
        }
        else {
            stockChange = Math.abs(quantity);
        }
        const newStock = product.stock + stockChange;
        if (newStock < 0) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient stock for this operation'
            });
        }
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
    }
    catch (error) {
        console.error('Adjust inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/low-stock', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 10;
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
    }
    catch (error) {
        console.error('Get low stock products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
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
    }
    catch (error) {
        console.error('Get inventory summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map