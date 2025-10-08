import { PrismaClient } from '@prisma/client';
import { DashboardStats, RevenueAnalytics, ProductAnalytics } from '../types';

const prisma = new PrismaClient();

export class AnalyticsService {
  /**
   * Get comprehensive dashboard statistics
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue,
        orderStatusCounts,
        paymentStatusCountsData,
        recentOrders,
        topProducts,
        monthlyRevenue,
        dailyRevenue
      ] = await Promise.all([
        // Total users (excluding admins)
        prisma.user.count({
          where: { role: 'CUSTOMER' }
        }),
        
        // Total orders
        prisma.order.count(),
        
        // Total active products
        prisma.product.count({
          where: { isActive: true }
        }),
        
        // Total revenue from completed orders
        prisma.order.aggregate({
          where: { 
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED'
          },
          _sum: { totalAmount: true }
        }),
        
        // Order status breakdown
        prisma.order.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        
        // Payment status breakdown
        prisma.payment.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        
        // Recent orders
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
        
        // Top selling products
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
        
        // Monthly revenue (last 12 months)
        prisma.$queryRaw`
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
        
        // Daily revenue (last 30 days)
        prisma.$queryRaw`
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

      // Format order status counts
      const statusCounts = orderStatusCounts.reduce((acc: any, item) => {
        acc[item.status.toLowerCase()] = item._count.status;
        return acc;
      }, {});

      // Format payment status counts
      const paymentStatusCounts = paymentStatusCountsData.reduce((acc: any, item) => {
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
        monthlyRevenue: monthlyRevenue as any[],
        dailyRevenue: dailyRevenue as any[]
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<RevenueAnalytics> {
    try {
      let interval: string;
      let periodLength: string;

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

      const revenueData = await prisma.$queryRaw`
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
        monthly: revenueData as any[],
        daily: [] // Will be populated separately if needed
      };
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get product analytics
   */
  static async getProductAnalytics(): Promise<ProductAnalytics> {
    try {
      const [
        topProducts,
        categoryBreakdown,
        inventoryStatus,
        reviewStats
      ] = await Promise.all([
        // Top selling products
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

        // Category breakdown
        prisma.product.groupBy({
          by: ['category'],
          _count: { category: true },
          _sum: { sales: true },
          _avg: { price: true },
          where: { isActive: true }
        }),

        // Inventory status
        prisma.product.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            stock: true,
            sales: true
          }
        }),

        // Review statistics
        prisma.review.groupBy({
          by: ['rating'],
          _count: { rating: true }
        })
      ]);

      // Calculate revenue for top products
      const topProductsWithRevenue = await Promise.all(
        topProducts.map(async (product) => {
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
        })
      );

      // Calculate low stock products
      const lowStockProducts = inventoryStatus.filter(p => p.stock < 10);
      const outOfStockProducts = inventoryStatus.filter(p => p.stock === 0);

      // Format category breakdown
      const formattedCategoryBreakdown = categoryBreakdown.map(cat => ({
        category: cat.category,
        count: cat._count.category,
        revenue: cat._sum.sales || 0
      }));

      return {
        topProducts: topProductsWithRevenue as any,
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
    } catch (error) {
      console.error('Error getting product analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  static async getCustomerAnalytics(): Promise<any> {
    try {
      const [
        totalCustomers,
        newCustomersThisMonth,
        customerOrderStats,
        topCustomers,
        customerLifetimeValue
      ] = await Promise.all([
        // Total customers
        prisma.user.count({
          where: { role: 'CUSTOMER' }
        }),

        // New customers this month
        prisma.user.count({
          where: {
            role: 'CUSTOMER',
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        }),

        // Customer order statistics
        prisma.order.groupBy({
          by: ['userId'],
          _count: { userId: true },
          _sum: { totalAmount: true },
          _avg: { totalAmount: true }
        }),

        // Top customers by spending
        prisma.order.groupBy({
          by: ['userId'],
          _sum: { totalAmount: true },
          _count: { userId: true },
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 10
        }),

        // Customer lifetime value
        prisma.order.aggregate({
          where: {
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED'
          },
          _avg: { totalAmount: true }
        })
      ]);

      // Get customer details for top customers
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
    } catch (error) {
      console.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get sales analytics
   */
  static async getSalesAnalytics(period: string = '30'): Promise<any> {
    try {
      const periodDays = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const [
        totalSales,
        totalOrders,
        averageOrderValue,
        salesByDay,
        salesByCategory,
        paymentMethodBreakdown
      ] = await Promise.all([
        // Total sales
        prisma.order.aggregate({
          where: {
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED',
            createdAt: { gte: startDate }
          },
          _sum: { totalAmount: true }
        }),

        // Total orders
        prisma.order.count({
          where: {
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED',
            createdAt: { gte: startDate }
          }
        }),

        // Average order value
        prisma.order.aggregate({
          where: {
            status: 'DELIVERED',
            paymentStatus: 'COMPLETED',
            createdAt: { gte: startDate }
          },
          _avg: { totalAmount: true }
        }),

        // Sales by day
        prisma.$queryRaw`
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

        // Sales by category
        prisma.$queryRaw`
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

        // Payment method breakdown
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
    } catch (error) {
      console.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get inventory analytics
   */
  static async getInventoryAnalytics(): Promise<any> {
    try {
      const [
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        topSellingProducts,
        inventoryValue,
        stockMovements
      ] = await Promise.all([
        // Total products
        prisma.product.count({
          where: { isActive: true }
        }),

        // Low stock products (< 10 units)
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

        // Out of stock products
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

        // Top selling products
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

        // Total inventory value
        prisma.product.aggregate({
          where: { isActive: true },
          _sum: {
            stock: true
          }
        }),

        // Recent stock movements
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
    } catch (error) {
      console.error('Error getting inventory analytics:', error);
      throw error;
    }
  }
}
