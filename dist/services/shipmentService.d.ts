import { ShipmentStatus } from '@prisma/client';
import { CreateShipmentRequest, UpdateShipmentRequest } from '../types';
export declare class ShipmentService {
    static createShipment(data: CreateShipmentRequest): Promise<any>;
    static updateShipmentStatus(shipmentId: string, data: UpdateShipmentRequest): Promise<any>;
    static getTrackingInfo(trackingNumber: string): Promise<any>;
    static getShipments(filters?: {
        status?: ShipmentStatus;
        carrier?: string;
        page?: number;
        limit?: number;
    }): Promise<any>;
    private static calculateShippingCost;
    private static calculateWeight;
    private static getTrackingEvents;
    private static createStatusNotification;
    static getShipmentAnalytics(): Promise<any>;
}
//# sourceMappingURL=shipmentService.d.ts.map