"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class AnalyticsService {
    static async getDashboardStats() {
        try {
            const [totalUsers, totalOrders, totalProducts, totalRevenue, orderStatusCounts, paymentStatusCountsData, recentOrders, topProducts, monthlyRevenue, dailyRevenue] = await Promise.all([
                prisma.user.count({
                    where: { role: 'CUSTOMER' }
                }),
                prisma.order.count(),
                prisma.product.count({
                    where: { isActive: true }
                }),
                prisma.order.aggregate({
                    where: {
                        status: 'DELIVERED',
                        paymentStatus: 'COMPLETED'
                    },
                    _sum: { totalAmount: true }
                }),
                prisma.order.groupBy({
                    by: ['status'],
                    _count: { status: true }
                }),
                prisma.payment.groupBy({
                    by: ['status'],
                    _count: { status: true }
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
                        rating: true,
                        reviewCount: true
                    }
                }),
                prisma.$queryRaw `
          SELECT 
            DATE_TRUNC('month', "createdAt") as month,
            SUM("totalAmount") as revenue,
            COUNT(*) as orders
          FROM "orders" 
          WHERE "status" = 'DELIVERED' 
          AND "paymentStatus" = 'COMPLETED'
          AND "createdAt" >= NOW() - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY month DESC
        `,
                prisma.$queryRaw `
          SELECT 
            DATE_TRUNC('day', "createdAt") as day,
            SUM("totalAmount") as revenue,
            COUNT(*) as orders
          FROM "orders" 
          WHERE "status" = 'DELIVERED' 
          AND "paymentStatus" = 'COMPLETED'
          AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY day DESC
        `
            ]);
            const statusCounts = orderStatusCounts.reduce((acc, item) => {
                acc[item.status.toLowerCase()] = item._count.status;
                return acc;
            }, {});
            const paymentStatusCounts = paymentStatusCountsData.reduce((acc, item) => {
                acc[item.status.toLowerCase()] = item._count.status;
                return acc;
            }, {});
            return {
                totalUsers,
                totalOrders,
                totalProducts,
                totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
                statusCounts,
                paymentStatusCounts,
                recentOrders,
                topProducts,
                monthlyRevenue: monthlyRevenue,
                dailyRevenue: dailyRevenue
            };
        }
        catch (error) {
            console.error('Error getting dashboard stats:', error);
            throw error;
        }
    }
    static async getRevenueAnalytics(period = 'monthly') {
        try {
            let interval;
            let periodLength;
            switch (period) {
                case 'daily':
                    interval = 'day';
                    periodLength = '30 days';
                    break;
                case 'weekly':
                    interval = 'week';
                    periodLength = '12 weeks';
                    break;
                default:
                    interval = 'month';
                    periodLength = '12 months';
            }
            const revenueData = await prisma.$queryRaw `
        SELECT 
          DATE_TRUNC(${interval}, "createdAt") as period,
          SUM("totalAmount") as revenue,
          COUNT(*) as orders,
          AVG("totalAmount") as avgOrderValue
        FROM "orders" 
        WHERE "status" = 'DELIVERED' 
        AND "paymentStatus" = 'COMPLETED'
        AND "createdAt" >= NOW() - INTERVAL ${periodLength}
        GROUP BY DATE_TRUNC(${interval}, "createdAt")
        ORDER BY period DESC
      `;
            return {
                monthly: revenueData,
                daily: []
            };
        }
        catch (error) {
            console.error('Error getting revenue analytics:', error);
            throw error;
        }
    }
    static async getProductAnalytics() {
        try {
            const [topProducts, categoryBreakdown, inventoryStatus, reviewStats] = await Promise.all([
                prisma.product.findMany({
                    take: 10,
                    orderBy: { sales: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        sales: true,
                        price: true,
                        rating: true,
                        reviewCount: true
                    }
                }),
                prisma.product.groupBy({
                    by: ['category'],
                    _count: { category: true },
                    _sum: { sales: true },
                    _avg: { price: true },
                    where: { isActive: true }
                }),
                prisma.product.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        stock: true,
                        sales: true
                    }
                }),
                prisma.review.groupBy({
                    by: ['rating'],
                    _count: { rating: true }
                })
            ]);
            const topProductsWithRevenue = await Promise.all(topProducts.map(async (product) => {
                const revenue = await prisma.orderItem.aggregate({
                    where: {
                        productId: product.id,
                        order: {
                            status: 'DELIVERED',
                            paymentStatus: 'COMPLETED'
                        }
                    },
                    _sum: {
                        price: true
                    }
                });
                return {
                    id: product.id,
                    name: product.name,
                    image: product.image,
                    sales: product.sales,
                    revenue: Number(revenue._sum.price) || 0
                };
            }));
            const lowStockProducts = inventoryStatus.filter(p => p.stock < 10);
            const outOfStockProducts = inventoryStatus.filter(p => p.stock === 0);
            const formattedCategoryBreakdown = categoryBreakdown.map(cat => ({
                category: cat.category,
                count: cat._count.category,
                revenue: cat._sum.sales || 0
            }));
            return {
                topProducts: topProductsWithRevenue,
                categoryBreakdown: formattedCategoryBreakdown,
                inventoryStatus: {
                    total: inventoryStatus.length,
                    lowStock: lowStockProducts.length,
                    outOfStock: outOfStockProducts.length,
                    lowStockProducts,
                    outOfStockProducts
                },
                reviewStats
            };
        }
        catch (error) {
            console.error('Error getting product analytics:', error);
            throw error;
        }
    }
    static async getCustomerAnalytics() {
        try {
            const [totalCustomers, newCustomersThisMonth, customerOrderStats, topCustomers, customerLifetimeValue] = await Promise.all([
                prisma.user.count({
                    where: { role: 'CUSTOMER' }
                }),
                prisma.user.count({
                    where: {
                        role: 'CUSTOMER',
                        createdAt: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    }
                }),
                prisma.order.groupBy({
                    by: ['userId'],
                    _count: { userId: true },
                    _sum: { totalAmount: true },
                    _avg: { totalAmount: true }
                }),
                prisma.order.groupBy({
                    by: ['userId'],
                    _sum: { totalAmount: true },
                    _count: { userId: true },
                    orderBy: { _sum: { totalAmount: 'desc' } },
                    take: 10
                }),
                prisma.order.aggregate({
                    where: {
                        status: 'DELIVERED',
                        paymentStatus: 'COMPLETED'
                    },
                    _avg: { totalAmount: true }
                })
            ]);
            const topCustomerIds = topCustomers.map(c => c.userId);
            const topCustomerDetails = await prisma.user.findMany({
                where: {
                    id: { in: topCustomerIds }
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    createdAt: true
                }
            });
            const enrichedTopCustomers = topCustomers.map(customer => {
                const details = topCustomerDetails.find(d => d.id === customer.userId);
                return {
                    ...customer,
                    customer: details
                };
            });
            return {
                totalCustomers,
                newCustomersThisMonth,
                customerOrderStats: {
                    averageOrdersPerCustomer: customerOrderStats.length > 0
                        ? customerOrderStats.reduce((sum, c) => sum + c._count.userId, 0) / customerOrderStats.length
                        : 0,
                    totalOrders: customerOrderStats.reduce((sum, c) => sum + c._count.userId, 0)
                },
                topCustomers: enrichedTopCustomers,
                averageCustomerLifetimeValue: customerLifetimeValue._avg.totalAmount || 0
            };
        }
        catch (error) {
            console.error('Error getting customer analytics:', error);
            throw error;
        }
    }
    static async getSalesAnalytics(period = '30') {
        try {
            const periodDays = parseInt(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - periodDays);
            const [totalSales, totalOrders, averageOrderValue, salesByDay, salesByCategory, paymentMethodBreakdown] = await Promise.all([
                prisma.order.aggregate({
                    where: {
                        status: 'DELIVERED',
                        paymentStatus: 'COMPLETED',
                        createdAt: { gte: startDate }
                    },
                    _sum: { totalAmount: true }
                }),
                prisma.order.count({
                    where: {
                        status: 'DELIVERED',
                        paymentStatus: 'COMPLETED',
                        createdAt: { gte: startDate }
                    }
                }),
                prisma.order.aggregate({
                    where: {
                        status: 'DELIVERED',
                        paymentStatus: 'COMPLETED',
                        createdAt: { gte: startDate }
                    },
                    _avg: { totalAmount: true }
                }),
                prisma.$queryRaw `
          SELECT 
            DATE_TRUNC('day', "createdAt") as day,
            SUM("totalAmount") as revenue,
            COUNT(*) as orders
          FROM "orders" 
          WHERE "status" = 'DELIVERED' 
          AND "paymentStatus" = 'COMPLETED'
          AND "createdAt" >= ${startDate}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY day DESC
        `,
                prisma.$queryRaw `
          SELECT 
            p.category,
            SUM(oi.price * oi.quantity) as revenue,
            COUNT(DISTINCT o.id) as orders,
            SUM(oi.quantity) as units_sold
          FROM "orders" o
          JOIN "order_items" oi ON o.id = oi."orderId"
          JOIN "products" p ON oi."productId" = p.id
          WHERE o.status = 'DELIVERED' 
          AND o."paymentStatus" = 'COMPLETED'
          AND o."createdAt" >= ${startDate}
          GROUP BY p.category
          ORDER BY revenue DESC
        `,
                prisma.payment.groupBy({
                    by: ['method'],
                    _count: { method: true },
                    _sum: { amount: true },
                    where: {
                        status: 'COMPLETED',
                        createdAt: { gte: startDate }
                    }
                })
            ]);
            return {
                totalSales: totalSales._sum.totalAmount || 0,
                totalOrders,
                averageOrderValue: averageOrderValue._avg.totalAmount || 0,
                salesByDay,
                salesByCategory,
                paymentMethodBreakdown
            };
        }
        catch (error) {
            console.error('Error getting sales analytics:', error);
            throw error;
        }
    }
    static async getInventoryAnalytics() {
        try {
            const [totalProducts, lowStockProducts, outOfStockProducts, topSellingProducts, inventoryValue, stockMovements] = await Promise.all([
                prisma.product.count({
                    where: { isActive: true }
                }),
                prisma.product.findMany({
                    where: {
                        isActive: true,
                        stock: { lt: 10, gt: 0 }
                    },
                    select: {
                        id: true,
                        name: true,
                        stock: true,
                        price: true,
                        sales: true
                    }
                }),
                prisma.product.findMany({
                    where: {
                        isActive: true,
                        stock: 0
                    },
                    select: {
                        id: true,
                        name: true,
                        stock: true,
                        price: true,
                        sales: true
                    }
                }),
                prisma.product.findMany({
                    where: { isActive: true },
                    orderBy: { sales: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        name: true,
                        sales: true,
                        stock: true,
                        price: true
                    }
                }),
                prisma.product.aggregate({
                    where: { isActive: true },
                    _sum: {
                        stock: true
                    }
                }),
                prisma.inventoryLog.findMany({
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true
                            }
                        }
                    }
                })
            ]);
            return {
                totalProducts,
                lowStockCount: lowStockProducts.length,
                outOfStockCount: outOfStockProducts.length,
                lowStockProducts,
                outOfStockProducts,
                topSellingProducts,
                totalInventoryValue: inventoryValue._sum.stock || 0,
                recentStockMovements: stockMovements
            };
        }
        catch (error) {
            console.error('Error getting inventory analytics:', error);
            throw error;
        }
    }
}
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=analyticsService.js.map