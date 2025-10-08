"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviews = exports.getProducts = exports.getOrders = exports.getUsers = exports.getDashboardStats = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getDashboardStats = async (req, res) => {
    try {
        const [totalUsers, totalOrders, totalProducts, totalRevenue, recentOrders, topProducts, monthlyRevenue] = await Promise.all([
            prisma.user.count({
                where: { role: 'CUSTOMER' }
            }),
            prisma.order.count(),
            prisma.product.count({
                where: { isActive: true }
            }),
            prisma.order.aggregate({
                where: { status: 'DELIVERED' },
                _sum: { totalAmount: true }
            }),
            prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    orderItems: {
                        include: {
                            product: {
                                select: {
                                    name: true,
                                    image: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.product.findMany({
                take: 5,
                orderBy: { sales: 'desc' },
                select: {
                    id: true,
                    name: true,
                    image: true,
                    price: true,
                    sales: true,
                    rating: true
                }
            }),
            prisma.$queryRaw `
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          SUM("totalAmount") as revenue,
          COUNT(*) as orders
        FROM "orders" 
        WHERE "status" = 'DELIVERED' 
        AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
      `
        ]);
        const orderStatusCounts = await prisma.order.groupBy({
            by: ['status'],
            _count: {
                status: true
            }
        });
        const statusCounts = orderStatusCounts.reduce((acc, item) => {
            acc[item.status.toLowerCase()] = item._count.status;
            return acc;
        }, {});
        res.json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    totalOrders,
                    totalProducts,
                    totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
                    statusCounts
                },
                recentOrders,
                topProducts,
                monthlyRevenue
            }
        });
    }
    catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getDashboardStats = getDashboardStats;
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    orders: {
                        select: {
                            id: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.user.count()
        ]);
        const usersWithOrderCount = users.map(user => ({
            ...user,
            orderCount: user.orders.length
        }));
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                users: usersWithOrderCount,
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
};
exports.getUsers = getUsers;
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = {};
        if (status) {
            where.status = status;
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
                    }
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
};
exports.getOrders = getOrders;
const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                include: {
                    reviews: {
                        select: {
                            id: true,
                            rating: true
                        }
                    },
                    _count: {
                        select: {
                            orderItems: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.product.count()
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
};
exports.getProducts = getProducts;
const getReviews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
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
            prisma.review.count()
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
};
exports.getReviews = getReviews;
//# sourceMappingURL=adminController.js.map