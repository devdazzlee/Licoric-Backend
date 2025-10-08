"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getCart = async (req, res) => {
    try {
        const cartItems = await prisma.cartItem.findMany({
            where: { userId: req.user.id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        originalPrice: true,
                        discount: true,
                        image: true,
                        stock: true,
                        isActive: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        let subtotal = 0;
        let totalItems = 0;
        cartItems.forEach(item => {
            if (item.product.isActive) {
                subtotal += Number(item.product.price) * item.quantity;
                totalItems += item.quantity;
            }
        });
        const shipping = subtotal > 50 ? 0 : 5.99;
        const tax = subtotal * 0.08;
        const total = subtotal + shipping + tax;
        res.json({
            success: true,
            data: {
                cartItems: cartItems.filter(item => item.product.isActive),
                summary: {
                    subtotal: parseFloat(subtotal.toFixed(2)),
                    shipping: parseFloat(shipping.toFixed(2)),
                    tax: parseFloat(tax.toFixed(2)),
                    total: parseFloat(total.toFixed(2)),
                    totalItems
                }
            }
        });
    }
    catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        if (!productId) {
            res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
            return;
        }
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });
        if (!product || !product.isActive) {
            res.status(404).json({
                success: false,
                message: 'Product not found or not available'
            });
            return;
        }
        const existingCartItem = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            }
        });
        if (existingCartItem) {
            const newQuantity = existingCartItem.quantity + parseInt(quantity);
            if (newQuantity > product.stock) {
                res.status(400).json({
                    success: false,
                    message: `Only ${product.stock} items available in stock`
                });
                return;
            }
            const updatedCartItem = await prisma.cartItem.update({
                where: {
                    userId_productId: {
                        userId: req.user.id,
                        productId: productId
                    }
                },
                data: { quantity: newQuantity },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            price: true,
                            originalPrice: true,
                            discount: true,
                            image: true,
                            stock: true
                        }
                    }
                }
            });
            res.json({
                success: true,
                message: 'Cart updated successfully',
                data: { cartItem: updatedCartItem }
            });
            return;
        }
        else {
            if (parseInt(quantity) > product.stock) {
                res.status(400).json({
                    success: false,
                    message: `Only ${product.stock} items available in stock`
                });
                return;
            }
            const cartItem = await prisma.cartItem.create({
                data: {
                    userId: req.user.id,
                    productId: productId,
                    quantity: parseInt(quantity)
                },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            price: true,
                            originalPrice: true,
                            discount: true,
                            image: true,
                            stock: true
                        }
                    }
                }
            });
            res.status(201).json({
                success: true,
                message: 'Item added to cart successfully',
                data: { cartItem }
            });
        }
    }
    catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        if (!quantity || quantity < 1) {
            res.status(400).json({
                success: false,
                message: 'Quantity must be at least 1'
            });
            return;
        }
        const existingCartItem = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            },
            include: { product: true }
        });
        if (!existingCartItem) {
            res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
            return;
        }
        if (parseInt(quantity) > existingCartItem.product.stock) {
            res.status(400).json({
                success: false,
                message: `Only ${existingCartItem.product.stock} items available in stock`
            });
            return;
        }
        const updatedCartItem = await prisma.cartItem.update({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            },
            data: { quantity: parseInt(quantity) },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        originalPrice: true,
                        discount: true,
                        image: true,
                        stock: true
                    }
                }
            }
        });
        res.json({
            success: true,
            message: 'Cart item updated successfully',
            data: { cartItem: updatedCartItem }
        });
    }
    catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateCartItem = updateCartItem;
const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        const cartItem = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            }
        });
        if (!cartItem) {
            res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
            return;
        }
        await prisma.cartItem.delete({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId: productId
                }
            }
        });
        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });
    }
    catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.removeFromCart = removeFromCart;
const clearCart = async (req, res) => {
    try {
        await prisma.cartItem.deleteMany({
            where: { userId: req.user.id }
        });
        res.json({
            success: true,
            message: 'Cart cleared successfully'
        });
    }
    catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.clearCart = clearCart;
//# sourceMappingURL=cartController.js.map