import { DashboardStats, RevenueAnalytics, ProductAnalytics } from '../types';
export declare class AnalyticsService {
    static getDashboardStats(): Promise<DashboardStats>;
    static getRevenueAnalytics(period?: 'daily' | 'weekly' | 'monthly'): Promise<RevenueAnalytics>;
    static getProductAnalytics(): Promise<ProductAnalytics>;
    static getCustomerAnalytics(): Promise<any>;
    static getSalesAnalytics(period?: string): Promise<any>;
    static getInventoryAnalytics(): Promise<any>;
}
//# sourceMappingURL=analyticsService.d.ts.map