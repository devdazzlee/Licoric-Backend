import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { NotificationData, SocketUser, SocketNotification } from '../types';

const prisma = new PrismaClient();

// Store connected users
const connectedUsers = new Map<string, SocketUser>();

export const setupSocketHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Handle user authentication and joining
    socket.on('join', async (data: { userId: string, role: string }) => {
      try {
        const { userId, role } = data;
        
        // Verify user exists
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Store user connection
        connectedUsers.set(socket.id, {
          userId,
          socketId: socket.id,
          role: role as any
        });

        // Join user to their personal room
        socket.join(`user_${userId}`);

        // Join admin to admin room if they're admin
        if (role === 'ADMIN') {
          socket.join('admin_room');
        }

        // Send connection confirmation
        socket.emit('joined', {
          message: 'Successfully connected',
          userId,
          role
        });

        // Send any unread notifications
        await sendUnreadNotifications(socket, userId);

        console.log(`👤 User ${userId} (${role}) joined`);
      } catch (error) {
        console.error('Error in join handler:', error);
        socket.emit('error', { message: 'Failed to join' });
      }
    });

    // Handle marking notifications as read
    socket.on('mark_notification_read', async (data: { notificationId: string }) => {
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
      } catch (error) {
        console.error('Error marking notification as read:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    // Handle admin actions
    socket.on('admin_action', async (data: any) => {
      try {
        const user = connectedUsers.get(socket.id);

        if (!user || user.role !== 'ADMIN') {
          socket.emit('error', { message: 'Admin access required' });
          return;
        }

        // Handle different admin actions
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
      } catch (error) {
        console.error('Error in admin action:', error);
        socket.emit('error', { message: 'Admin action failed' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        console.log(`👋 User ${user.userId} disconnected`);
        connectedUsers.delete(socket.id);
      }
    });
  });
};

/**
 * Send notification to specific user
 */
export const sendNotificationToUser = async (
  io: Server,
  userId: string,
  notification: NotificationData
): Promise<void> => {
  try {
    // Create notification in database
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

    // Send real-time notification
    io.to(`user_${userId}`).emit('new_notification', {
      id: createdNotification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      relatedId: notification.relatedId,
      createdAt: createdNotification.createdAt
    });

    console.log(`📨 Notification sent to user ${userId}: ${notification.title}`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

/**
 * Send notification to all admins
 */
export const sendNotificationToAdmins = async (
  io: Server,
  notification: Omit<NotificationData, 'userId'>
): Promise<void> => {
  try {
    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });

    // Send to all admins
    for (const admin of admins) {
      await sendNotificationToUser(io, admin.id, {
        ...notification,
        userId: admin.id
      });
    }

    // Also broadcast to admin room
    io.to('admin_room').emit('admin_notification', {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      relatedId: notification.relatedId,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Error sending admin notification:', error);
  }
};

/**
 * Send broadcast message to all connected users
 */
const handleBroadcastMessage = async (io: Server, message: any): Promise<void> => {
  try {
    // Create system notification for all users
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

    // Broadcast to all connected users
    io.emit('broadcast_message', {
      title: message.title || 'System Announcement',
      message: message.message,
      timestamp: new Date()
    });

    console.log('📢 Broadcast message sent to all users');
  } catch (error) {
    console.error('Error handling broadcast message:', error);
  }
};

/**
 * Handle system alerts
 */
const handleSystemAlert = async (io: Server, alert: any): Promise<void> => {
  try {
    // Send alert to admin room
    io.to('admin_room').emit('system_alert', {
      level: alert.level || 'info',
      title: alert.title,
      message: alert.message,
      timestamp: new Date()
    });

    console.log(`🚨 System alert: ${alert.title}`);
  } catch (error) {
    console.error('Error handling system alert:', error);
  }
};

/**
 * Send unread notifications to user when they connect
 */
const sendUnreadNotifications = async (socket: Socket, userId: string): Promise<void> => {
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
  } catch (error) {
    console.error('Error sending unread notifications:', error);
  }
};

/**
 * Get notification statistics
 */
export const getNotificationStats = async (): Promise<any> => {
  try {
    const [
      totalNotifications,
      unreadCount,
      typeBreakdown,
      recentNotifications
    ] = await Promise.all([
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
  } catch (error) {
    console.error('Error getting notification stats:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete old notifications (cleanup)
 */
export const cleanupOldNotifications = async (daysOld: number = 30): Promise<void> => {
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
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    throw error;
  }
};







