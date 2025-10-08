import { PrismaClient, ShipmentStatus } from '@prisma/client';
import { CreateShipmentRequest, UpdateShipmentRequest } from '../types';

const prisma = new PrismaClient();

export class ShipmentService {
  /**
   * Create a new shipment for an order
   */
  static async createShipment(data: CreateShipmentRequest): Promise<any> {
    try {
      // Verify order exists and is ready for shipment
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

      // Calculate shipping cost and weight
      const shippingCost = this.calculateShippingCost(order.orderItems);
      const weight = this.calculateWeight(order.orderItems);

      // Create shipment record
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

      // Update order status
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: 'PROCESSING'
        }
      });

      // Create notification
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
    } catch (error) {
      console.error('Error creating shipment:', error);
      throw error;
    }
  }

  /**
   * Update shipment status
   */
  static async updateShipmentStatus(
    shipmentId: string, 
    data: UpdateShipmentRequest
  ): Promise<any> {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: { order: { include: { user: true } } }
      });

      if (!shipment) {
        throw new Error('Shipment not found');
      }

      const updateData: any = {};
      if (data.status) updateData.status = data.status;
      if (data.trackingNumber) updateData.trackingNumber = data.trackingNumber;
      if (data.carrier) updateData.carrier = data.carrier;
      if (data.estimatedDelivery) updateData.estimatedDelivery = data.estimatedDelivery;
      if (data.actualDelivery) updateData.actualDelivery = data.actualDelivery;
      if (data.notes) updateData.notes = data.notes;

      const updatedShipment = await prisma.shipment.update({
        where: { id: shipmentId },
        data: updateData
      });

      // Update order status based on shipment status
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
            // Keep current status but add note
            break;
        }
      }

      if (orderStatus !== shipment.order.status) {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: { status: orderStatus }
        });
      }

      // Create notification for status changes
      if (data.status) {
        await this.createStatusNotification(shipment.order.userId, shipment.orderId, data.status);
      }

      return updatedShipment;
    } catch (error) {
      console.error('Error updating shipment:', error);
      throw error;
    }
  }

  /**
   * Get shipment tracking information
   */
  static async getTrackingInfo(trackingNumber: string): Promise<any> {
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

      // In a real implementation, you would integrate with carrier APIs
      // to get real-time tracking information
      const trackingEvents = await this.getTrackingEvents(trackingNumber, shipment.carrier);

      return {
        shipment,
        trackingEvents
      };
    } catch (error) {
      console.error('Error getting tracking info:', error);
      throw error;
    }
  }

  /**
   * Get all shipments with filtering
   */
  static async getShipments(filters: {
    status?: ShipmentStatus;
    carrier?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<any> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filters.status) where.status = filters.status;
      if (filters.carrier) where.carrier = filters.carrier;

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
    } catch (error) {
      console.error('Error getting shipments:', error);
      throw error;
    }
  }

  /**
   * Calculate shipping cost based on order items
   */
  private static calculateShippingCost(orderItems: any[]): number {
    // Simple shipping calculation - in real app, integrate with shipping APIs
    const totalWeight = this.calculateWeight(orderItems);
    const baseCost = 5.99;
    
    if (totalWeight > 5) {
      return baseCost + ((totalWeight - 5) * 0.5);
    }
    
    return baseCost;
  }

  /**
   * Calculate total weight of order items
   */
  private static calculateWeight(orderItems: any[]): number {
    return orderItems.reduce((total, item) => {
      // Assuming each product has a weight of 0.1 lbs
      return total + (item.quantity * 0.1);
    }, 0);
  }

  /**
   * Get tracking events from carrier API
   */
  private static async getTrackingEvents(trackingNumber: string, carrier: string): Promise<any[]> {
    // Mock tracking events - in real implementation, integrate with carrier APIs
    const mockEvents = [
      {
        date: new Date(),
        status: 'Package picked up',
        location: 'Origin Facility',
        description: 'Package has been picked up from the origin facility'
      },
      {
        date: new Date(Date.now() - 86400000), // 1 day ago
        status: 'In transit',
        location: 'Sort Facility',
        description: 'Package is in transit to the destination'
      },
      {
        date: new Date(Date.now() - 172800000), // 2 days ago
        status: 'Processed',
        location: 'Origin Facility',
        description: 'Package has been processed at the origin facility'
      }
    ];

    return mockEvents;
  }

  /**
   * Create notification for shipment status changes
   */
  private static async createStatusNotification(
    userId: string, 
    orderId: string, 
    status: ShipmentStatus
  ): Promise<void> {
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

  /**
   * Get shipment analytics
   */
  static async getShipmentAnalytics(): Promise<any> {
    try {
      const [
        totalShipments,
        statusCounts,
        carrierCounts,
        avgDeliveryTime
      ] = await Promise.all([
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
          _avg: {
            // Calculate average delivery time
          }
        })
      ]);

      return {
        totalShipments,
        statusBreakdown: statusCounts,
        carrierBreakdown: carrierCounts,
        avgDeliveryTime: avgDeliveryTime._avg
      };
    } catch (error) {
      console.error('Error getting shipment analytics:', error);
      throw error;
    }
  }
}
