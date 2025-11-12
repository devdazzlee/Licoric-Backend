import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user!.id },
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

    // Calculate totals
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
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
export const addToCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }

    // Check if product exists and is active
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

    // Check if item already exists in cart
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId: productId
        }
      }
    });

    if (existingCartItem) {
      // Update quantity
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
            userId: req.user!.id,
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
    } else {
      // Add new item to cart
      if (parseInt(quantity) > product.stock) {
        res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`
        });
        return;
      }

      const cartItem = await prisma.cartItem.create({
        data: {
          userId: req.user!.id,
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
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/update/:productId
// @access  Private
export const updateCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Check if cart item exists
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
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

    // Check stock availability
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
          userId: req.user!.id,
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
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Private
export const removeFromCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    const cartItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
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
          userId: req.user!.id,
          productId: productId
        }
      }
    });

    res.json({
      success: true,
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
export const clearCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.user!.id }
    });

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};







