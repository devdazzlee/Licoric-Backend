"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReview = exports.updateReview = exports.createReview = exports.getReviews = exports.getProductReviews = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
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
    }
    catch (error) {
        console.error('Get product reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getProductReviews = getProductReviews;
const getReviews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
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
    }
    catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.getReviews = getReviews;
const createReview = async (req, res) => {
    try {
        const { productId, rating, title, comment, guestName, guestEmail } = req.body;
        const userId = req.user?.id;
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
        const reviewData = {
            productId,
            rating: parseInt(rating),
            title: title || null,
            comment,
            isVerified: userId ? true : false,
        };
        if (userId) {
            reviewData.userId = userId;
        }
        else {
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
    }
    catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.createReview = createReview;
const updateReview = async (req, res) => {
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
        if (existingReview.userId !== req.user.id) {
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
    }
    catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.updateReview = updateReview;
const deleteReview = async (req, res) => {
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
        if (existingReview.userId !== req.user.id && req.user.role !== 'ADMIN') {
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
        }
        else {
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
    }
    catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.deleteReview = deleteReview;
//# sourceMappingURL=reviewController.js.map