import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { Response, NextFunction } from 'express';

const prisma = new PrismaClient();

export const auth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies?.accessToken;
    
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// Optional auth: doesn't require authentication but sets user if token is valid
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies?.accessToken;
    
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    // If no token, continue as guest
    if (!token) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true
        }
      });

      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      // Invalid token, continue as guest
      console.log('Optional auth: Invalid token, continuing as guest');
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

export const adminAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await auth(req, res, () => {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
        return;
      }
      next();
    });
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
};
