import { Request } from 'express';
import { User, Role, OrderStatus, PaymentStatus } from '@prisma/client';

// Extended Request interface with user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: Role;
    isActive: boolean;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: any[];
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// User types
export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

// Product types
export interface CreateProductRequest {
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  brand?: string;
  weight?: string;
  ingredients?: string;
  allergens?: string;
  nutritionFacts?: any;
  stock: number;
  sku?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  category?: string;
  brand?: string;
  weight?: string;
  ingredients?: string;
  allergens?: string;
  nutritionFacts?: any;
  stock?: number;
  sku?: string;
  isActive?: boolean;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// Cart types
export interface AddToCartRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartRequest {
  quantity: number;
}

export interface CartSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  totalItems: number;
}

// Order types
export interface CreateOrderRequest {
  shippingFirstName: string;
  shippingLastName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZipCode: string;
  shippingCountry: string;
  shippingPhone?: string;
  paymentMethod: string;
  notes?: string;
}

export interface UpdateOrderStatusRequest {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  trackingNumber?: string;
  carrier?: string;
}

// Review types
export interface CreateReviewRequest {
  productId: string;
  rating: number;
  title?: string;
  comment: string;
}

export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  comment?: string;
}

// Contact types
export interface CreateContactRequest {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface UpdateContactRequest {
  status: 'unread' | 'read' | 'replied';
}

// Payment types
export interface PaymentIntentRequest {
  amount: number;
  currency: string;
  orderId: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface PaymentConfirmationRequest {
  paymentIntentId: string;
  orderId: string;
}

// Shipment types
export interface CreateShipmentRequest {
  orderId: string;
  carrier: string;
  trackingNumber: string;
  estimatedDelivery?: Date | null;
}

export interface UpdateShipmentRequest {
  status?: 'PENDING' | 'PREPARING' | 'SHIPPED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION' | 'RETURNED';
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  notes?: string;
}

// Notification types
export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'ORDER' | 'PAYMENT' | 'SHIPMENT' | 'REVIEW' | 'GENERAL' | 'PROMOTION' | 'SYSTEM';
  relatedId?: string;
  read?: boolean;
  data?: any;
}

// Analytics types
export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  statusCounts: Record<string, number>;
  paymentStatusCounts?: Record<string, number>;
  recentOrders?: any[];
  topProducts?: any[];
  monthlyRevenue?: any[];
  dailyRevenue?: any[];
}

export interface RevenueAnalytics {
  monthly: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
  daily: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
}

export interface ProductAnalytics {
  topProducts: Array<{
    id: string;
    name: string;
    image: string;
    sales: number;
    revenue: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    revenue: number;
  }>;
  inventoryStatus?: any;
  reviewStats?: any;
}

// Email types
export interface EmailTemplate {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  shippingAddress: string;
}

// File upload types
export interface FileUploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
}

// Socket.io types
export interface SocketUser {
  userId: string;
  socketId: string;
  role: Role;
}

export interface SocketNotification {
  userId: string;
  message: string;
  type: string;
  data?: any;
}

// Environment types
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  EMAIL_HOST: string;
  EMAIL_PORT: number;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  FRONTEND_URL: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}
