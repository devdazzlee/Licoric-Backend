"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrders = exports.getOrder = exports.getUserOrders = exports.createOrder = void 0;
const client_1 = require("@prisma/client");
const emailService_1 = require("../services/emailService");
const prisma = new client_1.PrismaClient();
const createOrder = async (req, res) => {
    try {
        const { shippingFirstName, shippingLastName, shippingAddress, shippingCity, shippingState, shippingZipCode, shippingCountry, shippingPhone, paymentMethod, notes, guestEmail, items } = req.body;
        const isGuest = !req.user;
        let cartItems = [];
        if (isGuest) {
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
            const productIds = items.map((item) => item.productId);
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
            cartItems = items.map((item) => {
                const product = products.find(p => p.id === item.productId);
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    product
                };
            });
        }
        else {
            cartItems = await prisma.cartItem.findMany({
                where: { userId: req.user.id },
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
        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += Number(item.product.price) * item.quantity;
        });
        const shippingAmount = subtotal > 50 ? 0 : 5.99;
        const taxAmount = subtotal * 0.08;
        const totalAmount = subtotal + shippingAmount + taxAmount;
        const orderNumber = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId: isGuest ? null : req.user.id,
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
            const orderItems = [];
            for (const item of cartItems) {
                const orderItem = await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.product.price
                    }
                });
                orderItems.push(orderItem);
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
            if (!isGuest) {
                await tx.cartItem.deleteMany({
                    where: { userId: req.user.id }
                });
            }
            return { order, orderItems };
        });
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
        if (completeOrder) {
            const customerEmail = isGuest ? guestEmail : completeOrder.user?.email;
            const customerName = isGuest
                ? `${shippingFirstName} ${shippingLastName}`
                : `${completeOrder.user?.firstName} ${completeOrder.user?.lastName}`;
            if (customerEmail) {
                await (0, emailService_1.sendEmail)({
                    to: customerEmail,
                    subject: `Order Confirmation - #${completeOrder.orderNumber}`,
                    html: emailService_1.emailTemplates.orderConfirmation({
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
    }
    catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.createOrder = createOrder;
const getUserOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: { userId: req.user.id },
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
                where: { userId: req.user.id }
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
    }
    catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getUserOrders = getUserOrders;
const getOrder = async (req, res) => {
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
        if (req.user) {
            if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
                return;
            }
        }
        else {
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
    }
    catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getOrder = getOrder;
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = {};
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
    }
    catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getOrders = getOrders;
const updateOrderStatus = async (req, res) => {
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
        const updateData = {};
        if (status)
            updateData.status = status;
        if (paymentStatus)
            updateData.paymentStatus = paymentStatus;
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
    }
    catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateOrderStatus = updateOrderStatus;
//# sourceMappingURL=orderController.js.map