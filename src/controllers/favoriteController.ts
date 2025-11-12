import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

// @desc    Get user's favorites
// @route   GET /api/favorites
// @access  Private
export const getFavorites = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favorite.findMany({
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
            category: true,
            brand: true,
            rating: true,
            reviewCount: true,
            stock: true,
            isActive: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out inactive products
    const activeFavorites = favorites.filter(fav => fav.product.isActive);

    res.json({
      success: true,
      data: { favorites: activeFavorites }
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add product to favorites
// @route   POST /api/favorites/add
// @access  Private
export const addToFavorites = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.body;

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

    // Check if already in favorites
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId: productId
        }
      }
    });

    if (existingFavorite) {
      res.status(400).json({
        success: false,
        message: 'Product already in favorites'
      });
      return;
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user!.id,
        productId: productId
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
            category: true,
            brand: true,
            rating: true,
            reviewCount: true,
            stock: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Product added to favorites successfully',
      data: { favorite }
    });
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Remove product from favorites
// @route   DELETE /api/favorites/remove/:productId
// @access  Private
export const removeFromFavorites = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId: productId
        }
      }
    });

    if (!favorite) {
      res.status(404).json({
        success: false,
        message: 'Product not found in favorites'
      });
      return;
    }

    await prisma.favorite.delete({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId: productId
        }
      }
    });

    res.json({
      success: true,
      message: 'Product removed from favorites successfully'
    });
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};







