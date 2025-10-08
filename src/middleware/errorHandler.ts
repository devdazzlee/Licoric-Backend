import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  let error: any = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404, name: 'CastError' };
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400, name: 'DuplicateKeyError' };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = { message, statusCode: 400, name: 'ValidationError' };
  }

  // Prisma errors
  if ((err as any).code === 'P2002') {
    const message = 'A record with this data already exists';
    error = { message, statusCode: 400, name: 'PrismaError' };
  }

  if ((err as any).code === 'P2025') {
    const message = 'Record not found';
    error = { message, statusCode: 404, name: 'PrismaError' };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
