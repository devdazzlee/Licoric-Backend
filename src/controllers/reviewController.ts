import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          productId,
          isActive: true
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.review.count({
        where: {
          productId,
          isActive: true
        }
      })
    ]);

    // Calculate rating stats
    const ratingStats = await prisma.review.groupBy({
      by: ['rating'],
      where: {
        productId,
        isActive: true
      },
      _count: {
        rating: true
      }
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        ratingStats
      }
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all reviews (Admin)
// @route   GET /api/reviews
// @access  Private/Admin
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.review.count()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reviews,
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
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create review
// @route   POST /api/reviews
// @access  Public (supports both authenticated and anonymous)
export const createReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId, rating, title, comment, guestName, guestEmail } = req.body;
    const userId = req.user?.id;

    // Check if product exists
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

    // For authenticated users, check if they already reviewed this product
    if (userId) {
      const existingReview = await prisma.review.findFirst({
        where: {
          userId: userId,
          productId: productId
        }
      });

      if (existingReview) {
        res.status(400).json({
          success: false,
          message: 'You have already reviewed this product'
        });
        return;
      }
    }

    // Create review (authenticated or anonymous)
    const reviewData: any = {
      productId,
      rating: parseInt(rating),
      title: title || null,
      comment,
      isVerified: userId ? true : false, // Verified only if authenticated
    };

    // Add user ID if authenticated, otherwise add guest info
    if (userId) {
      reviewData.userId = userId;
    } else {
      reviewData.guestName = guestName || 'Anonymous';
      reviewData.guestEmail = guestEmail || null;
    }

    const review = await prisma.review.create({
      data: reviewData,
      include: {
        user: userId ? {
          select: {
            firstName: true,
            lastName: true
          }
        } : undefined
      }
    });

    // Update product rating and review count
    const productReviews = await prisma.review.findMany({
      where: {
        productId,
        isActive: true
      },
      select: {
        rating: true
      }
    });

    const totalRating = productReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / productReviews.length;

    await prisma.product.update({
      where: { id: productId },
      data: {
        rating: parseFloat(averageRating.toFixed(2)),
        reviewCount: productReviews.length
      }
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { rating, title, comment } = req.body;

    const existingReview = await prisma.review.findUnique({
      where: { id: req.params.id }
    });

    if (!existingReview) {
      res.status(404).json({
        success: false,
        message: 'Review not found'
      });
      return;
    }

    // Check if user owns this review
    if (existingReview.userId !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        ...(rating && { rating: parseInt(rating) }),
        ...(title && { title }),
        ...(comment && { comment })
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Update product rating if rating changed
    if (rating && rating !== existingReview.rating) {
      const productReviews = await prisma.review.findMany({
        where: {
          productId: review.productId,
          isActive: true
        },
        select: {
          rating: true
        }
      });

      const totalRating = productReviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRating / productReviews.length;

      await prisma.product.update({
        where: { id: review.productId },
        data: {
          rating: parseFloat(averageRating.toFixed(2)),
          reviewCount: productReviews.length
        }
      });
    }

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existingReview = await prisma.review.findUnique({
      where: { id: req.params.id }
    });

    if (!existingReview) {
      res.status(404).json({
        success: false,
        message: 'Review not found'
      });
      return;
    }

    // Check if user owns this review or is admin
    if (existingReview.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    await prisma.review.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    // Update product rating and review count
    const productReviews = await prisma.review.findMany({
      where: {
        productId: existingReview.productId,
        isActive: true
      },
      select: {
        rating: true
      }
    });

    if (productReviews.length > 0) {
      const totalRating = productReviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / productReviews.length;

      await prisma.product.update({
        where: { id: existingReview.productId },
        data: {
          rating: parseFloat(averageRating.toFixed(2)),
          reviewCount: productReviews.length
        }
      });
    } else {
      await prisma.product.update({
        where: { id: existingReview.productId },
        data: {
          rating: 0,
          reviewCount: 0
        }
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


