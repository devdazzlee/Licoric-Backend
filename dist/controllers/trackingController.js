"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReferralCode = exports.getReferralCodes = exports.createReferralCode = exports.getDashboardStats = exports.getStats = exports.trackOrder = exports.trackClick = exports.trackEvents = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getClientIp = (req) => {
    return (req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.headers["x-real-ip"] ||
        req.socket.remoteAddress ||
        undefined);
};
const trackEvents = async (req, res) => {
    try {
        const { events, websiteId, sessionId } = req.body;
        if (!events || !Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ error: "Events array is required" });
        }
        if (!websiteId) {
            return res.status(400).json({ error: "websiteId is required" });
        }
        let website = await prisma.website.findFirst({
            where: { id: websiteId },
        });
        if (!website) {
            const domain = req.headers.origin || req.headers.referer;
            website = await prisma.website.create({
                data: {
                    id: websiteId,
                    name: websiteId,
                    domain: domain || undefined,
                },
            });
        }
        const savedEvents = await Promise.all(events.map((event) => prisma.trackingEvent.create({
            data: {
                websiteId: website.id,
                sessionId: sessionId || event.sessionId,
                userId: event.userId,
                event: event.event || "unknown",
                data: event.data || {},
                page: event.page || {},
                device: event.device || {},
                browser: event.browser || {},
                timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
            },
        })));
        console.log(`✅ Tracked ${savedEvents.length} events for website ${websiteId}`);
        res.status(200).json({
            success: true,
            message: `Tracked ${savedEvents.length} events`,
            count: savedEvents.length,
        });
    }
    catch (error) {
        console.error("Error tracking events:", error);
        res.status(500).json({
            error: "Failed to track events",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.trackEvents = trackEvents;
const trackClick = async (req, res) => {
    try {
        const { referralCode, storeId, websiteId, url, referrer, userAgent } = req.body;
        if (!referralCode) {
            return res.status(400).json({ error: "referralCode is required" });
        }
        const siteId = websiteId || storeId;
        if (!siteId) {
            return res.status(400).json({
                error: "websiteId or storeId is required",
            });
        }
        let website = await prisma.website.findFirst({
            where: { id: siteId },
        });
        if (!website) {
            website = await prisma.website.create({
                data: {
                    id: siteId,
                    name: siteId,
                },
            });
        }
        let referral = await prisma.referralCode.findUnique({
            where: { code: referralCode },
        });
        if (!referral) {
            referral = await prisma.referralCode.create({
                data: {
                    code: referralCode,
                    isActive: true,
                },
            });
        }
        const click = await prisma.referralClick.create({
            data: {
                referralCode: referral.code,
                websiteId: website.id,
                url: url || undefined,
                referrer: referrer || undefined,
                userAgent: userAgent || undefined,
                ipAddress: getClientIp(req),
            },
        });
        console.log(`✅ Tracked click for referral code ${referralCode} on website ${siteId}`);
        res.status(200).json({
            success: true,
            message: "Click tracked successfully",
            clickId: click.id,
        });
    }
    catch (error) {
        console.error("Error tracking click:", error);
        res.status(500).json({
            error: "Failed to track click",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.trackClick = trackClick;
const trackOrder = async (req, res) => {
    try {
        const { referralCode, storeId, websiteId, orderId, orderValue, value, currency = "USD", } = req.body;
        if (!referralCode) {
            return res.status(400).json({ error: "referralCode is required" });
        }
        if (!orderId) {
            return res.status(400).json({ error: "orderId is required" });
        }
        const orderAmount = orderValue || value || 0;
        const siteId = websiteId || storeId;
        console.log(`📦 Tracking order request:`, {
            referralCode,
            orderId,
            orderValue,
            value,
            orderAmount,
            websiteId: siteId,
        });
        if (!orderAmount || orderAmount <= 0) {
            console.error(`❌ Invalid order amount: ${orderAmount}`, {
                referralCode,
                orderId,
                orderValue,
                value,
            });
            return res.status(400).json({
                error: "orderValue is required and must be greater than 0",
                received: { orderValue, value, calculated: orderAmount },
            });
        }
        if (!siteId) {
            return res.status(400).json({
                error: "websiteId or storeId is required",
            });
        }
        let website = await prisma.website.findFirst({
            where: { id: siteId },
        });
        if (!website) {
            website = await prisma.website.create({
                data: {
                    id: siteId,
                    name: siteId,
                },
            });
        }
        let referral = await prisma.referralCode.findUnique({
            where: { code: referralCode },
        });
        if (!referral) {
            referral = await prisma.referralCode.create({
                data: {
                    code: referralCode,
                    isActive: true,
                },
            });
        }
        const existingOrder = await prisma.referralOrder.findFirst({
            where: {
                orderId: orderId,
                referralCode: referral.code,
            },
        });
        if (existingOrder) {
            return res.status(200).json({
                success: true,
                message: "Order already tracked",
                orderId: existingOrder.id,
                commission: existingOrder.commission,
                commissionRate: referral.commissionRate,
            });
        }
        const commissionRate = referral.commissionRate || 0.1;
        const commission = orderAmount * commissionRate;
        console.log(`💰 Commission calculation:`, {
            referralCode: referral.code,
            orderAmount,
            commissionRate,
            commission,
            commissionPercentage: `${(commissionRate * 100).toFixed(2)}%`,
        });
        const referralOrder = await prisma.referralOrder.create({
            data: {
                referralCode: referral.code,
                websiteId: website.id,
                orderId: orderId,
                orderValue: orderAmount,
                currency: currency,
                commission: commission,
                status: "pending",
            },
        });
        console.log(`✅ Tracked order ${orderId} for referral code ${referralCode} with value ${orderAmount}`);
        res.status(200).json({
            success: true,
            message: "Order tracked successfully",
            orderId: referralOrder.id,
            commission: commission,
            commissionRate: commissionRate,
        });
    }
    catch (error) {
        console.error("Error tracking order:", error);
        res.status(500).json({
            error: "Failed to track order",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.trackOrder = trackOrder;
const getStats = async (req, res) => {
    try {
        const { websiteId, referralCode, startDate, endDate } = req.query;
        const where = {};
        if (websiteId) {
            where.websiteId = websiteId;
        }
        if (referralCode) {
            where.referralCode = referralCode;
        }
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) {
                where.timestamp.gte = new Date(startDate);
            }
            if (endDate) {
                where.timestamp.lte = new Date(endDate);
            }
        }
        const clicks = await prisma.referralClick.count({ where });
        const orders = await prisma.referralOrder.count({ where });
        const totalOrderValue = await prisma.referralOrder.aggregate({
            where,
            _sum: { orderValue: true },
        });
        const totalCommission = await prisma.referralOrder.aggregate({
            where,
            _sum: { commission: true },
        });
        res.status(200).json({
            success: true,
            clicks,
            orders,
            totalOrderValue: totalOrderValue._sum.orderValue || 0,
            totalCommission: totalCommission._sum.commission || 0,
            conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
        });
    }
    catch (error) {
        console.error("Error getting stats:", error);
        res.status(500).json({
            error: "Failed to get stats",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getStats = getStats;
const getDashboardStats = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate) {
                dateFilter.timestamp.gte = new Date(startDate);
            }
            if (endDate) {
                dateFilter.timestamp.lte = new Date(endDate);
            }
        }
        const referralCodesWhere = {};
        if (userId) {
            referralCodesWhere.userId = userId;
        }
        const referralCodes = await prisma.referralCode.findMany({
            where: referralCodesWhere,
            include: {
                clicks: {
                    where: dateFilter,
                },
                orders: {
                    where: dateFilter,
                },
            },
        });
        const codeStats = referralCodes.map((code) => {
            const clicks = code.clicks.length;
            const orders = code.orders.length;
            const totalOrderValue = code.orders.reduce((sum, order) => sum + order.orderValue, 0);
            const totalCommission = code.orders.reduce((sum, order) => sum + (order.commission || 0), 0);
            return {
                code: code.code,
                commissionRate: code.commissionRate,
                clicks,
                orders,
                totalOrderValue,
                totalCommission,
                conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
                isActive: code.isActive,
                createdAt: code.createdAt,
            };
        });
        const totalClicks = referralCodes.reduce((sum, code) => sum + code.clicks.length, 0);
        const totalOrders = referralCodes.reduce((sum, code) => sum + code.orders.length, 0);
        const overallOrderValue = referralCodes.reduce((sum, code) => sum +
            code.orders.reduce((orderSum, order) => orderSum + order.orderValue, 0), 0);
        const overallCommission = referralCodes.reduce((sum, code) => sum +
            code.orders.reduce((orderSum, order) => orderSum + (order.commission || 0), 0), 0);
        res.status(200).json({
            success: true,
            overall: {
                totalClicks,
                totalOrders,
                totalOrderValue: overallOrderValue,
                totalCommission: overallCommission,
                conversionRate: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
            },
            byCode: codeStats,
        });
    }
    catch (error) {
        console.error("Error getting dashboard stats:", error);
        res.status(500).json({
            error: "Failed to get dashboard stats",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getDashboardStats = getDashboardStats;
const createReferralCode = async (req, res) => {
    try {
        const { code, userId, commissionRate = 0.1, isActive = true } = req.body;
        if (!code) {
            return res.status(400).json({ error: "code is required" });
        }
        const referralCode = await prisma.referralCode.create({
            data: {
                code,
                userId: userId || undefined,
                commissionRate,
                isActive,
            },
        });
        res.status(201).json({
            success: true,
            referralCode,
        });
    }
    catch (error) {
        console.error("Error creating referral code:", error);
        res.status(500).json({
            error: "Failed to create referral code",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.createReferralCode = createReferralCode;
const getReferralCodes = async (req, res) => {
    try {
        const { userId, isActive } = req.query;
        const where = {};
        if (userId) {
            where.userId = userId;
        }
        if (isActive !== undefined) {
            where.isActive = isActive === "true";
        }
        const referralCodes = await prisma.referralCode.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json({
            success: true,
            referralCodes,
        });
    }
    catch (error) {
        console.error("Error getting referral codes:", error);
        res.status(500).json({
            error: "Failed to get referral codes",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getReferralCodes = getReferralCodes;
const updateReferralCode = async (req, res) => {
    try {
        const { code } = req.params;
        const { commissionRate, isActive } = req.body;
        const referralCode = await prisma.referralCode.update({
            where: { code },
            data: {
                ...(commissionRate !== undefined && { commissionRate }),
                ...(isActive !== undefined && { isActive }),
            },
        });
        res.status(200).json({
            success: true,
            referralCode,
        });
    }
    catch (error) {
        console.error("Error updating referral code:", error);
        res.status(500).json({
            error: "Failed to update referral code",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateReferralCode = updateReferralCode;
//# sourceMappingURL=trackingController.js.map