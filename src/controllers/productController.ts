import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { uploadToCloudinary } from '../utils/cloudinary';

const prisma = new PrismaClient();

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const minPrice = parseFloat(req.query.minPrice as string);
    const maxPrice = parseFloat(req.query.maxPrice as string);

    const where: any = {
      isActive: true,
      ...(category && { category }),
      ...(minPrice && maxPrice && {
        price: {
          gte: minPrice,
          lte: maxPrice
        }
      })
    };

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          shortDescription: true,
          price: true,
          originalPrice: true,
          discount: true,
          image: true,
          images: true,
          category: true,
          brand: true,
          sku: true,
          rating: true,
          reviewCount: true,
          sales: true,
          stock: true,
          isActive: true,
          createdAt: true
        }
      }),
      prisma.product.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        products,
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
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!product || !product.isActive) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { product }
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    const category = req.query.category as string;
    const minPrice = req.query.minPrice as string;
    const maxPrice = req.query.maxPrice as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } }
        ]
      }),
      ...(category && { category }),
      ...(minPrice && maxPrice && {
        price: {
          gte: parseFloat(minPrice),
          lte: parseFloat(maxPrice)
        }
      })
    };

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
          sales: true,
          stock: true
        }
      }),
      prisma.product.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        products,
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
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          category: category,
          isActive: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
          sku: true,
          rating: true,
          reviewCount: true,
          sales: true,
          stock: true
        }
      }),
      prisma.product.count({
        where: {
          category: category,
          isActive: true
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        products,
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
    console.error('Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔍 Create product request body:', req.body);
    console.log('📸 Image from request:', req.body.image);
    
    const {
      name,
      description,
      shortDescription,
      price,
      originalPrice,
      discount,
      category,
      brand,
      weight,
      ingredients,
      allergens,
      nutritionFacts,
      stock,
      sku,
      image: imageFromBody
    } = req.body;

    let image = imageFromBody || null; // Use image URL from body if provided
    console.log('🖼️ Image value to use:', image);
    
    let images: string[] = [];

    // Handle single image upload (if file is provided directly)
    if ((req as any).file) {
      image = await uploadToCloudinary((req as any).file);
    }

    // Handle multiple images upload
    if ((req as any).files && (req as any).files.length > 0) {
      for (const file of (req as any).files) {
        const uploadedImage = await uploadToCloudinary(file);
        images.push(uploadedImage);
      }
      if (!image && images.length > 0) {
        image = images[0];
      }
    }

    const finalImage = image || '';
    console.log('✨ Final image value for database:', finalImage);

    const product = await prisma.product.create({
      data: {
        name,
        description,
        shortDescription,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        discount: discount ? parseInt(discount) : null,
        image: finalImage,
        images,
        category,
        brand,
        weight,
        ingredients,
        allergens,
        nutritionFacts: nutritionFacts ? JSON.parse(nutritionFacts) : null,
        stock: parseInt(stock) || 0,
        sku
      }
    });

    console.log('✅ Product created with image:', product.image);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      originalPrice,
      discount,
      category,
      brand,
      weight,
      ingredients,
      allergens,
      nutritionFacts,
      stock,
      sku,
      isActive
    } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id }
    });

    if (!existingProduct) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    let image = req.body.image || existingProduct.image; // Use image URL from body if provided
    let images = existingProduct.images || [];

    // Handle single image upload (if file is provided directly)
    if ((req as any).file) {
      image = await uploadToCloudinary((req as any).file);
    }

    // Handle multiple images upload
    if ((req as any).files && (req as any).files.length > 0) {
      images = [];
      for (const file of (req as any).files) {
        const uploadedImage = await uploadToCloudinary(file);
        images.push(uploadedImage);
      }
      if (!image && images.length > 0) {
        image = images[0];
      }
    }

    // Build update data object, only including fields that are provided
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (originalPrice !== undefined) updateData.originalPrice = originalPrice ? parseFloat(originalPrice) : null;
    if (discount !== undefined) updateData.discount = discount ? parseInt(discount) : null;
    if (image !== undefined && image !== null && image !== '') updateData.image = image;
    if (images !== undefined) updateData.images = images;
    if (category !== undefined) updateData.category = category;
    if (brand !== undefined) updateData.brand = brand;
    if (weight !== undefined) updateData.weight = weight;
    if (ingredients !== undefined) updateData.ingredients = ingredients;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (nutritionFacts !== undefined && nutritionFacts !== null && nutritionFacts !== '') {
      try {
        updateData.nutritionFacts = typeof nutritionFacts === 'string' ? JSON.parse(nutritionFacts) : nutritionFacts;
      } catch (e) {
        // If parsing fails, skip it
      }
    }
    if (stock !== undefined) updateData.stock = parseInt(stock) || 0;
    if (sku !== undefined) updateData.sku = sku;
    
    // Handle isActive properly - can be boolean or string 'true'/'false'
    if (isActive !== undefined) {
      if (typeof isActive === 'boolean') {
        updateData.isActive = isActive;
      } else if (typeof isActive === 'string') {
        updateData.isActive = isActive === 'true' || isActive === '1';
      } else {
        updateData.isActive = Boolean(isActive);
      }
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        orderItems: {
          select: { id: true }
        }
      }
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Check if product has any order items
    if (product.orderItems && product.orderItems.length > 0) {
      // Product has orders - use soft delete instead
      await prisma.product.update({
        where: { id: req.params.id },
        data: {
          isActive: false
        }
      });

      res.json({
        success: true,
        message: 'Product deactivated successfully (cannot delete products with existing orders)',
        softDelete: true
      });
      return;
    }

    // No orders exist - safe to hard delete
    await prisma.product.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    
    // Handle specific foreign key constraint error
    if (error.code === 'P2003') {
      res.status(400).json({
        success: false,
        message: 'Cannot delete product: It is referenced in existing orders. The product has been deactivated instead.',
        softDelete: true
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


