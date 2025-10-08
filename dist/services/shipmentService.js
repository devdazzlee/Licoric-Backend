"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipmentService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class ShipmentService {
    static async createShipment(data) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: data.orderId },
                include: {
                    user: true,
                    shipment: true,
                    orderItems: {
                        include: {
                            product: true
                        }
                    }
                }
            });
            if (!order) {
                throw new Error('Order not found');
            }
            if (order.status !== 'CONFIRMED' && order.status !== 'PROCESSING') {
                throw new Error('Order is not ready for shipment');
            }
            if (order.shipment) {
                throw new Error('Shipment already exists for this order');
            }
            const shippingCost = this.calculateShippingCost(order.orderItems);
            const weight = this.calculateWeight(order.orderItems);
            const shipment = await prisma.shipment.create({
                data: {
                    orderId: data.orderId,
                    carrier: data.carrier,
                    trackingNumber: data.trackingNumber,
                    status: 'PENDING',
                    estimatedDelivery: data.estimatedDelivery,
                    shippingCost,
                    weight,
                    dimensions: {
                        length: 10,
                        width: 8,
                        height: 2
                    }
                }
            });
            await prisma.order.update({
                where: { id: data.orderId },
                data: {
                    status: 'PROCESSING'
                }
            });
            await prisma.notification.create({
                data: {
                    userId: order.userId,
                    title: 'Order Shipped',
                    message: `Your order has been shipped! Tracking number: ${data.trackingNumber}`,
                    type: 'SHIPMENT',
                    relatedId: data.orderId
                }
            });
            return shipment;
        }
        catch (error) {
            console.error('Error creating shipment:', error);
            throw error;
        }
    }
    static async updateShipmentStatus(shipmentId, data) {
        try {
            const shipment = await prisma.shipment.findUnique({
                where: { id: shipmentId },
                include: { order: { include: { user: true } } }
            });
            if (!shipment) {
                throw new Error('Shipment not found');
            }
            const updateData = {};
            if (data.status)
                updateData.status = data.status;
            if (data.trackingNumber)
                updateData.trackingNumber = data.trackingNumber;
            if (data.carrier)
                updateData.carrier = data.carrier;
            if (data.estimatedDelivery)
                updateData.estimatedDelivery = data.estimatedDelivery;
            if (data.actualDelivery)
                updateData.actualDelivery = data.actualDelivery;
            if (data.notes)
                updateData.notes = data.notes;
            const updatedShipment = await prisma.shipment.update({
                where: { id: shipmentId },
                data: updateData
            });
            let orderStatus = shipment.order.status;
            if (data.status) {
                switch (data.status) {
                    case 'SHIPPED':
                    case 'IN_TRANSIT':
                        orderStatus = 'SHIPPED';
                        break;
                    case 'DELIVERED':
                        orderStatus = 'DELIVERED';
                        break;
                    case 'EXCEPTION':
                        break;
                }
            }
            if (orderStatus !== shipment.order.status) {
                await prisma.order.update({
                    where: { id: shipment.orderId },
                    data: { status: orderStatus }
                });
            }
            if (data.status) {
                await this.createStatusNotification(shipment.order.userId, shipment.orderId, data.status);
            }
            return updatedShipment;
        }
        catch (error) {
            console.error('Error updating shipment:', error);
            throw error;
        }
    }
    static async getTrackingInfo(trackingNumber) {
        try {
            const shipment = await prisma.shipment.findUnique({
                where: { trackingNumber },
                include: {
                    order: {
                        include: {
                            user: true,
                            orderItems: {
                                include: {
                                    product: true
                                }
                            }
                        }
                    }
                }
            });
            if (!shipment) {
                throw new Error('Shipment not found');
            }
            const trackingEvents = await this.getTrackingEvents(trackingNumber, shipment.carrier);
            return {
                shipment,
                trackingEvents
            };
        }
        catch (error) {
            console.error('Error getting tracking info:', error);
            throw error;
        }
    }
    static async getShipments(filters = {}) {
        try {
            const page = filters.page || 1;
            const limit = filters.limit || 10;
            const skip = (page - 1) * limit;
            const where = {};
            if (filters.status)
                where.status = filters.status;
            if (filters.carrier)
                where.carrier = filters.carrier;
            const [shipments, total] = await Promise.all([
                prisma.shipment.findMany({
                    where,
                    include: {
                        order: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit
                }),
                prisma.shipment.count({ where })
            ]);
            const totalPages = Math.ceil(total / limit);
            return {
                shipments,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };
        }
        catch (error) {
            console.error('Error getting shipments:', error);
            throw error;
        }
    }
    static calculateShippingCost(orderItems) {
        const totalWeight = this.calculateWeight(orderItems);
        const baseCost = 5.99;
        if (totalWeight > 5) {
            return baseCost + ((totalWeight - 5) * 0.5);
        }
        return baseCost;
    }
    static calculateWeight(orderItems) {
        return orderItems.reduce((total, item) => {
            return total + (item.quantity * 0.1);
        }, 0);
    }
    static async getTrackingEvents(trackingNumber, carrier) {
        const mockEvents = [
            {
                date: new Date(),
                status: 'Package picked up',
                location: 'Origin Facility',
                description: 'Package has been picked up from the origin facility'
            },
            {
                date: new Date(Date.now() - 86400000),
                status: 'In transit',
                location: 'Sort Facility',
                description: 'Package is in transit to the destination'
            },
            {
                date: new Date(Date.now() - 172800000),
                status: 'Processed',
                location: 'Origin Facility',
                description: 'Package has been processed at the origin facility'
            }
        ];
        return mockEvents;
    }
    static async createStatusNotification(userId, orderId, status) {
        let title = '';
        let message = '';
        switch (status) {
            case 'SHIPPED':
                title = 'Order Shipped';
                message = 'Your order has been shipped and is on its way!';
                break;
            case 'IN_TRANSIT':
                title = 'Order In Transit';
                message = 'Your order is currently in transit to your location.';
                break;
            case 'OUT_FOR_DELIVERY':
                title = 'Out for Delivery';
                message = 'Your order is out for delivery and will arrive today!';
                break;
            case 'DELIVERED':
                title = 'Order Delivered';
                message = 'Your order has been delivered successfully!';
                break;
            case 'EXCEPTION':
                title = 'Delivery Exception';
                message = 'There was an issue with your delivery. Please contact support.';
                break;
            default:
                title = 'Shipment Update';
                message = 'Your shipment status has been updated.';
        }
        await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type: 'SHIPMENT',
                relatedId: orderId
            }
        });
    }
    static async getShipmentAnalytics() {
        try {
            const [totalShipments, statusCounts, carrierCounts, avgDeliveryTime] = await Promise.all([
                prisma.shipment.count(),
                prisma.shipment.groupBy({
                    by: ['status'],
                    _count: { status: true }
                }),
                prisma.shipment.groupBy({
                    by: ['carrier'],
                    _count: { carrier: true }
                }),
                prisma.shipment.aggregate({
                    _avg: {}
                })
            ]);
            return {
                totalShipments,
                statusBreakdown: statusCounts,
                carrierBreakdown: carrierCounts,
                avgDeliveryTime: avgDeliveryTime._avg
            };
        }
        catch (error) {
            console.error('Error getting shipment analytics:', error);
            throw error;
        }
    }
}
exports.ShipmentService = ShipmentService;
//# sourceMappingURL=shipmentService.js.map