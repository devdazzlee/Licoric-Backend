import { PrismaClient } from '@prisma/client';
import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendEmail, emailTemplates } from '../services/emailService';

const prisma = new PrismaClient();

// @desc    Create new order
// @route   POST /api/orders
// @access  Public (supports both authenticated and guest checkout)
export const createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      shippingFirstName,
      shippingLastName,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingZipCode,
      shippingCountry,
      shippingPhone,
      paymentMethod,
      notes,
      guestEmail,
      items // For guest checkout, items come directly from request
    } = req.body;

    const isGuest = !req.user;
    let cartItems: any[] = [];

    if (isGuest) {
      // Guest checkout: validate items from request body
      if (!items || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
        return;
      }

      if (!guestEmail) {
        res.status(400).json({
          success: false,
          message: 'Email is required for guest checkout'
        });
        return;
      }

      // Fetch product details for guest items
      const productIds = items.map((item: any) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          isActive: true
        }
      });

      // Map items with product details
      cartItems = items.map((item: any) => {
        const product = products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          product
        };
      });
    } else {
      // Authenticated user: get cart items from database
      cartItems = await prisma.cartItem.findMany({
        where: { userId: req.user!.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              isActive: true
            }
          }
        }
      });

      if (cartItems.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
        return;
      }
    }

    // Check stock availability
    for (const item of cartItems) {
      if (!item.product.isActive) {
        res.status(400).json({
          success: false,
          message: `Product "${item.product.name}" is no longer available`
        });
        return;
      }
      if (item.quantity > item.product.stock) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`
        });
        return;
      }
    }

    // Calculate totals
    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += Number(item.product.price) * item.quantity;
    });

    const shippingAmount = subtotal > 50 ? 0 : 5.99;
    const taxAmount = subtotal * 0.08;
    const totalAmount = subtotal + shippingAmount + taxAmount;

    // Generate order number
    const orderNumber = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: isGuest ? null : req.user!.id,
          guestEmail: isGuest ? guestEmail : null,
          totalAmount,
          shippingAmount,
          taxAmount,
          shippingFirstName,
          shippingLastName,
          shippingAddress,
          shippingCity,
          shippingState,
          shippingZipCode,
          shippingCountry,
          shippingPhone,
          paymentMethod,
          notes
        }
      });

      // Create order items and update stock
      const orderItems = [];
      for (const item of cartItems) {
        // Create order item
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price
          }
        });
        orderItems.push(orderItem);

        // Update product stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            },
            sales: {
              increment: item.quantity
            }
          }
        });
      }

      // Clear user's cart (only for authenticated users)
      if (!isGuest) {
        await tx.cartItem.deleteMany({
          where: { userId: req.user!.id }
        });
      }

      return { order, orderItems };
    });

    // Fetch complete order details
    const completeOrder = await prisma.order.findUnique({
      where: { id: result.order.id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                price: true
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Send order confirmation email
    if (completeOrder) {
      const customerEmail = isGuest ? guestEmail : completeOrder.user?.email;
      const customerName = isGuest 
        ? `${shippingFirstName} ${shippingLastName}`
        : `${completeOrder.user?.firstName} ${completeOrder.user?.lastName}`;

      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `Order Confirmation - #${completeOrder.orderNumber}`,
          html: emailTemplates.orderConfirmation({
            customerName,
            orderNumber: completeOrder.orderNumber,
            orderDate: new Date(completeOrder.createdAt).toLocaleDateString(),
            status: completeOrder.status,
            items: completeOrder.orderItems.map(item => ({
              name: item.product.name,
              quantity: item.quantity,
              price: Number(item.price).toFixed(2)
            })),
            total: Number(completeOrder.totalAmount).toFixed(2),
            orderId: completeOrder.id,
            shippingAddress: {
              firstName: completeOrder.shippingFirstName,
              lastName: completeOrder.shippingLastName,
              address: completeOrder.shippingAddress,
              city: completeOrder.shippingCity,
              state: completeOrder.shippingState,
              zipCode: completeOrder.shippingZipCode
            }
          })
        }).catch(err => console.error('Failed to send order email:', err));
      }
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order: completeOrder }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getUserOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: req.user!.id },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  price: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.order.count({
        where: { userId: req.user!.id }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        orders,
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
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                price: true,
                description: true
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Check if user owns this order or is admin
    if (req.user) {
      // Authenticated user: check ownership or admin role
      if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
    } else {
      // Guest user: can only access if they don't have a userId (guest order)
      if (order.userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  price: true
                }
              }
            }
          },
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
      prisma.order.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        orders,
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
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, paymentStatus } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: req.params.id }
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                price: true
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
