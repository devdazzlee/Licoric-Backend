"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const socketService_1 = require("../services/socketService");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
const createNotificationValidation = [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('message').notEmpty().withMessage('Message is required'),
    (0, express_validator_1.body)('type').isIn(['ORDER', 'PAYMENT', 'SHIPMENT', 'REVIEW', 'GENERAL', 'PROMOTION', 'SYSTEM']).withMessage('Invalid notification type')
];
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unreadOnly === 'true';
        const where = { userId: req.user.id };
        if (unreadOnly) {
            where.read = false;
        }
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.notification.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                notifications,
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
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/:id/read', auth_1.auth, async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.findUnique({
            where: { id }
        });
        if (!notification) {
            res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
            return;
        }
        if (notification.userId !== req.user.id) {
            res.status(403).json({
                success: false,
                message: 'Access denied'
            });
            return;
        }
        await prisma.notification.update({
            where: { id },
            data: { read: true }
        });
        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/mark-all-read', auth_1.auth, async (req, res) => {
    try {
        await (0, socketService_1.markAllNotificationsAsRead)(req.user.id);
        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/unread-count', auth_1.auth, async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: {
                userId: req.user.id,
                read: false
            }
        });
        res.json({
            success: true,
            data: { count }
        });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/', auth_1.auth, auth_1.adminAuth, createNotificationValidation, async (req, res) => {
    try {
        const { userId, title, message, type, relatedId, data } = req.body;
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                relatedId,
                data
            }
        });
        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            data: { notification }
        });
    }
    catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/admin', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const type = req.query.type;
        const unreadOnly = req.query.unreadOnly === 'true';
        const where = {};
        if (type)
            where.type = type;
        if (unreadOnly)
            where.read = false;
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
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
            prisma.notification.count({ where })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            success: true,
            data: {
                notifications,
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
        console.error('Get admin notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.get('/stats', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const stats = await (0, socketService_1.getNotificationStats)();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/broadcast', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { title, message, type = 'GENERAL' } = req.body;
        const users = await prisma.user.findMany({
            where: { isActive: true }
        });
        const notifications = await Promise.all(users.map(user => prisma.notification.create({
            data: {
                userId: user.id,
                title,
                message,
                type,
                data: { broadcast: true }
            }
        })));
        res.json({
            success: true,
            message: `Broadcast notification sent to ${users.length} users`,
            data: { sentCount: notifications.length }
        });
    }
    catch (error) {
        console.error('Broadcast notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.delete('/:id', auth_1.auth, async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.findUnique({
            where: { id }
        });
        if (!notification) {
            res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
            return;
        }
        if (notification.userId !== req.user.id && req.user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Access denied'
            });
            return;
        }
        await prisma.notification.delete({
            where: { id }
        });
        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.put('/bulk-read', auth_1.auth, auth_1.adminAuth, async (req, res) => {
    try {
        const { notificationIds } = req.body;
        if (!Array.isArray(notificationIds)) {
            res.status(400).json({
                success: false,
                message: 'Notification IDs must be an array'
            });
            return;
        }
        await prisma.notification.updateMany({
            where: {
                id: { in: notificationIds }
            },
            data: { read: true }
        });
        res.json({
            success: true,
            message: `${notificationIds.length} notifications marked as read`
        });
    }
    catch (error) {
        console.error('Bulk mark notifications as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=notification.js.map