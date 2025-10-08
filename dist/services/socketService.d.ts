import { Server } from 'socket.io';
import { NotificationData } from '../types';
export declare const setupSocketHandlers: (io: Server) => void;
export declare const sendNotificationToUser: (io: Server, userId: string, notification: NotificationData) => Promise<void>;
export declare const sendNotificationToAdmins: (io: Server, notification: Omit<NotificationData, "userId">) => Promise<void>;
export declare const getNotificationStats: () => Promise<any>;
export declare const markAllNotificationsAsRead: (userId: string) => Promise<void>;
export declare const cleanupOldNotifications: (daysOld?: number) => Promise<void>;
//# sourceMappingURL=socketService.d.ts.map