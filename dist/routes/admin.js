"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const analyticsService_1 = require("../services/analyticsService");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
router.use(auth_1.auth, auth_1.adminAuth);
const updateProductValidation = [
    (0, express_validator_1.body)('name').optional().notEmpty().withMessage('Name cannot be empty'),
    (0, express_validator_1.body)('price').optional().isNumeric().withMessage('Price must be a number'),
    (0, express_validator_1.body)('stock').optional().isInt().withMessage('Stock must be an integer'),
    (0, express_validator_1.body)('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];
router.get('/dashboard', async (req, res) => {
    try {
        const stats = await analyticsService_1.AnalyticsService.getDashboardStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/analytics/revenue', async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const analytics = await analyticsService_1.AnalyticsService.getRevenueAnalytics(period);
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('Get revenue analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/analytics/products', async (req, res) => {
    try {
        const analytics = await analyticsService_1.AnalyticsService.getProductAnalytics();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('Get product analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/analytics/customers', async (req, res) => {
    try {
        const analytics = await analyticsService_1.AnalyticsService.getCustomerAnalytics();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('Get customer analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/analytics/sales', async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const analytics = await analyticsService_1.AnalyticsService.getSalesAnalytics(period);
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('Get sales analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/analytics/inventory', async (req, res) => {
    try {
        const analytics = await analyticsService_1.AnalyticsService.getInventoryAnalytics();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('Get inventory analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const role = req.query.role;
        const isActive = req.query.isActive;
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (role)
            where.role = role;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    orders: {
                        select: {
                            id: true,
                            totalAmount: true,
                            status: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.user.count({ where })
        ]);
        const usersWithStats = users.map(user => ({
            ...user,
            orderCount: user.orders.length,
            totalSpent: user.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
            lastOrderDate: user.orders.length > 0
                ? user.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt
                : null
        }));
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                users: usersWithStats,
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
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const paymentStatus = req.query.paymentStatus;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const where = {};
        if (status)
            where.status = status;
        if (paymentStatus)
            where.paymentStatus = paymentStatus;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    orderItems: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    image: true,
                                    price: true
                                }
                            }
                        }
                    },
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    payment: true,
                    shipment: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.order.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                orders,
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
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const isActive = req.query.isActive;
        const lowStock = req.query.lowStock === 'true';
        const where = {};
        if (category)
            where.category = category;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        if (lowStock)
            where.stock = { lt: 10 };
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    reviews: {
                        select: {
                            id: true,
                            rating: true
                        }
                    },
                    inventoryLogs: {
                        take: 5,
                        orderBy: { createdAt: 'desc' }
                    },
                    _count: {
                        select: {
                            orderItems: true,
                            reviews: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.product.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                products,
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
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/products/:id', updateProductValidation, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const product = await prisma.product.findUnique({
            where: { id }
        });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        const updatedProduct = await prisma.product.update({
            where: { id },
            data: updateData
        });
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: { product: updatedProduct }
        });
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/reviews', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const rating = req.query.rating;
        const isActive = req.query.isActive;
        const where = {};
        if (rating)
            where.rating = parseInt(rating);
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    product: {
                        select: {
                            id: true,
                            name: true,
                            image: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.review.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                reviews,
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
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, totalOrders, totalProducts, totalRevenue, todayOrders, todayRevenue, pendingOrders, lowStockProducts, recentActivity] = await Promise.all([
            prisma.user.count({ where: { role: 'CUSTOMER' } }),
            prisma.order.count(),
            prisma.product.count({ where: { isActive: true } }),
            prisma.order.aggregate({
                where: {
                    status: 'DELIVERED',
                    paymentStatus: 'COMPLETED'
                },
                _sum: { totalAmount: true }
            }),
            prisma.order.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),
            prisma.order.aggregate({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    },
                    paymentStatus: 'COMPLETED'
                },
                _sum: { totalAmount: true }
            }),
            prisma.order.count({ where: { status: 'PENDING' } }),
            prisma.product.count({ where: { stock: { lt: 10 } } }),
            prisma.auditLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            })
        ]);
        res.json({
            success: true,
            data: {
                totalUsers,
                totalOrders,
                totalProducts,
                totalRevenue: totalRevenue._sum.totalAmount || 0,
                todayOrders,
                todayRevenue: todayRevenue._sum.totalAmount || 0,
                pendingOrders,
                lowStockProducts,
                recentActivity
            }
        });
    }
    catch (error) {
        console.error('Get system stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/audit-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const action = req.query.action;
        const entity = req.query.entity;
        const where = {};
        if (action)
            where.action = action;
        if (entity)
            where.entity = entity;
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.auditLog.count({ where })
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
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map