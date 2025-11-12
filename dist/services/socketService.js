"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldNotifications = exports.markAllNotificationsAsRead = exports.getNotificationStats = exports.sendNotificationToAdmins = exports.sendNotificationToUser = exports.setupSocketHandlers = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const connectedUsers = new Map();
const setupSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 User connected: ${socket.id}`);
        socket.on('join', async (data) => {
            try {
                const { userId, role } = data;
                const user = await prisma.user.findUnique({
                    where: { id: userId }
                });
                if (!user) {
                    socket.emit('error', { message: 'User not found' });
                    return;
                }
                connectedUsers.set(socket.id, {
                    userId,
                    socketId: socket.id,
                    role: role
                });
                socket.join(`user_${userId}`);
                if (role === 'ADMIN') {
                    socket.join('admin_room');
                }
                socket.emit('joined', {
                    message: 'Successfully connected',
                    userId,
                    role
                });
                await sendUnreadNotifications(socket, userId);
                console.log(`👤 User ${userId} (${role}) joined`);
            }
            catch (error) {
                console.error('Error in join handler:', error);
                socket.emit('error', { message: 'Failed to join' });
            }
        });
        socket.on('mark_notification_read', async (data) => {
            try {
                const { notificationId } = data;
                const user = connectedUsers.get(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }
                await prisma.notification.update({
                    where: {
                        id: notificationId,
                        userId: user.userId
                    },
                    data: { read: true }
                });
                socket.emit('notification_read', { notificationId });
            }
            catch (error) {
                console.error('Error marking notification as read:', error);
                socket.emit('error', { message: 'Failed to mark notification as read' });
            }
        });
        socket.on('admin_action', async (data) => {
            try {
                const user = connectedUsers.get(socket.id);
                if (!user || user.role !== 'ADMIN') {
                    socket.emit('error', { message: 'Admin access required' });
                    return;
                }
                switch (data.action) {
                    case 'broadcast_message':
                        await handleBroadcastMessage(io, data.message);
                        break;
                    case 'system_alert':
                        await handleSystemAlert(io, data.alert);
                        break;
                    default:
                        socket.emit('error', { message: 'Unknown admin action' });
                }
            }
            catch (error) {
                console.error('Error in admin action:', error);
                socket.emit('error', { message: 'Admin action failed' });
            }
        });
        socket.on('disconnect', () => {
            const user = connectedUsers.get(socket.id);
            if (user) {
                console.log(`👋 User ${user.userId} disconnected`);
                connectedUsers.delete(socket.id);
            }
        });
    });
};
exports.setupSocketHandlers = setupSocketHandlers;
const sendNotificationToUser = async (io, userId, notification) => {
    try {
        const createdNotification = await prisma.notification.create({
            data: {
                userId: notification.userId,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                relatedId: notification.relatedId,
                data: notification.data
            }
        });
        io.to(`user_${userId}`).emit('new_notification', {
            id: createdNotification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            relatedId: notification.relatedId,
            createdAt: createdNotification.createdAt
        });
        console.log(`📨 Notification sent to user ${userId}: ${notification.title}`);
    }
    catch (error) {
        console.error('Error sending notification:', error);
    }
};
exports.sendNotificationToUser = sendNotificationToUser;
const sendNotificationToAdmins = async (io, notification) => {
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' }
        });
        for (const admin of admins) {
            await (0, exports.sendNotificationToUser)(io, admin.id, {
                ...notification,
                userId: admin.id
            });
        }
        io.to('admin_room').emit('admin_notification', {
            title: notification.title,
            message: notification.message,
            type: notification.type,
            relatedId: notification.relatedId,
            createdAt: new Date()
        });
    }
    catch (error) {
        console.error('Error sending admin notification:', error);
    }
};
exports.sendNotificationToAdmins = sendNotificationToAdmins;
const handleBroadcastMessage = async (io, message) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true }
        });
        for (const user of users) {
            await prisma.notification.create({
                data: {
                    userId: user.id,
                    title: message.title || 'System Announcement',
                    message: message.message,
                    type: 'SYSTEM',
                    data: { broadcast: true }
                }
            });
        }
        io.emit('broadcast_message', {
            title: message.title || 'System Announcement',
            message: message.message,
            timestamp: new Date()
        });
        console.log('📢 Broadcast message sent to all users');
    }
    catch (error) {
        console.error('Error handling broadcast message:', error);
    }
};
const handleSystemAlert = async (io, alert) => {
    try {
        io.to('admin_room').emit('system_alert', {
            level: alert.level || 'info',
            title: alert.title,
            message: alert.message,
            timestamp: new Date()
        });
        console.log(`🚨 System alert: ${alert.title}`);
    }
    catch (error) {
        console.error('Error handling system alert:', error);
    }
};
const sendUnreadNotifications = async (socket, userId) => {
    try {
        const unreadNotifications = await prisma.notification.findMany({
            where: {
                userId,
                read: false
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        if (unreadNotifications.length > 0) {
            socket.emit('unread_notifications', unreadNotifications);
        }
    }
    catch (error) {
        console.error('Error sending unread notifications:', error);
    }
};
const getNotificationStats = async () => {
    try {
        const [totalNotifications, unreadCount, typeBreakdown, recentNotifications] = await Promise.all([
            prisma.notification.count(),
            prisma.notification.count({ where: { read: false } }),
            prisma.notification.groupBy({
                by: ['type'],
                _count: { type: true }
            }),
            prisma.notification.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
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
        return {
            totalNotifications,
            unreadCount,
            typeBreakdown,
            recentNotifications
        };
    }
    catch (error) {
        console.error('Error getting notification stats:', error);
        throw error;
    }
};
exports.getNotificationStats = getNotificationStats;
const markAllNotificationsAsRead = async (userId) => {
    try {
        await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
    }
    catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const cleanupOldNotifications = async (daysOld = 30) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        await prisma.notification.deleteMany({
            where: {
                createdAt: { lt: cutoffDate },
                read: true
            }
        });
        console.log(`🧹 Cleaned up notifications older than ${daysOld} days`);
    }
    catch (error) {
        console.error('Error cleaning up notifications:', error);
        throw error;
    }
};
exports.cleanupOldNotifications = cleanupOldNotifications;
//# sourceMappingURL=socketService.js.map