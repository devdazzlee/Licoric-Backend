# Licorice Ropes Backend API v2.0 - TypeScript Edition

A complete Node.js TypeScript backend API for the Licorice Ropes e-commerce website with advanced features including payment integration, shipment tracking, real-time notifications, and comprehensive admin dashboard.

## 🚀 New Features in v2.0

### 💳 **Payment Integration**
- **Stripe Integration** - Complete payment processing with webhooks
- **PayPal Support** - Alternative payment method
- **Refund Management** - Automated refund processing
- **Payment Analytics** - Transaction tracking and reporting

### 📦 **Shipment & Tracking**
- **Multi-Carrier Support** - UPS, FedEx, USPS integration
- **Real-time Tracking** - Live shipment status updates
- **Delivery Notifications** - Automatic customer notifications
- **Shipping Analytics** - Carrier performance metrics

### 🔔 **Real-time Notifications**
- **Socket.IO Integration** - Live notifications
- **Push Notifications** - Browser and mobile support
- **Email Notifications** - Automated email alerts
- **Admin Broadcasting** - System-wide announcements

### 📊 **Advanced Admin Dashboard**
- **Comprehensive Analytics** - Revenue, sales, customer insights
- **Inventory Management** - Stock tracking and alerts
- **Order Management** - Advanced order processing
- **User Management** - Customer and admin controls
- **Audit Logging** - Complete activity tracking

### 🛠️ **Technical Improvements**
- **TypeScript Support** - Full type safety
- **Enhanced Security** - Rate limiting, CORS, Helmet
- **Database Optimization** - Advanced Prisma queries
- **API Documentation** - Comprehensive endpoint docs

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Authentication**: JWT with role-based access
- **Payments**: Stripe + PayPal
- **Real-time**: Socket.IO
- **File Upload**: Cloudinary
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate limiting
- **Validation**: Express-validator

## 📋 Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- PostgreSQL database
- Cloudinary account
- Stripe account
- PayPal account (optional)

## 🔧 Installation

1. **Clone and Setup**
   ```bash
   cd backend
   yarn install
   ```

2. **Environment Configuration**
   ```bash
   # Copy and update environment variables
   cp .env.example .env
   ```
   
   Update `.env` with your credentials:
   ```env
   # Database
   DATABASE_URL="your-postgresql-connection-string"
   
   # JWT
   JWT_SECRET="your-jwt-secret"
   JWT_EXPIRES_IN="7d"
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   
   # Stripe Payment
   STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
   STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
   STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
   
   # PayPal Payment
   PAYPAL_CLIENT_ID="your_paypal_client_id"
   PAYPAL_CLIENT_SECRET="your_paypal_client_secret"
   
   # Email Configuration
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT=587
   EMAIL_USER="your_email@gmail.com"
   EMAIL_PASS="your_app_password"
   
   # Server
   PORT=5000
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:3000"
   ```

3. **Database Setup**
   ```bash
   # Generate Prisma client
   yarn db:generate
   
   # Push schema to database
   yarn db:push
   
   # Seed the database
   yarn db:seed
   ```

4. **Start Development Server**
   ```bash
   yarn dev
   ```

## 📚 API Endpoints

### 🔐 Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### 🛍️ Products
- `GET /api/products` - Get all products (with advanced filtering)
- `GET /api/products/:id` - Get single product
- `GET /api/products/search` - Search products
- `GET /api/products/category/:category` - Get products by category
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### 🛒 Cart & Favorites
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update/:productId` - Update cart item
- `DELETE /api/cart/remove/:productId` - Remove item from cart
- `GET /api/favorites` - Get user's favorites
- `POST /api/favorites/add` - Add to favorites
- `DELETE /api/favorites/remove/:productId` - Remove from favorites

### 💳 Payment System
- `POST /api/payment/create-intent` - Create Stripe payment intent
- `POST /api/payment/confirm` - Confirm payment
- `POST /api/payment/webhook` - Stripe webhook handler
- `POST /api/payment/refund/:orderId` - Create refund (Admin)
- `GET /api/payment/methods/:customerId` - Get payment methods

### 📦 Shipment & Tracking
- `POST /api/shipment/create` - Create shipment (Admin)
- `PUT /api/shipment/:id/status` - Update shipment status
- `GET /api/shipment/track/:trackingNumber` - Get tracking info
- `GET /api/shipment` - Get all shipments (Admin)
- `GET /api/shipment/analytics` - Get shipment analytics

### 🔔 Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `GET /api/notifications/unread-count` - Get unread count
- `POST /api/notifications/broadcast` - Broadcast message (Admin)

### 📊 Admin Dashboard
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/analytics/revenue` - Revenue analytics
- `GET /api/admin/analytics/products` - Product analytics
- `GET /api/admin/analytics/customers` - Customer analytics
- `GET /api/admin/analytics/sales` - Sales analytics
- `GET /api/admin/analytics/inventory` - Inventory analytics
- `GET /api/admin/users` - Get all users with filtering
- `GET /api/admin/orders` - Get all orders with filtering
- `GET /api/admin/products` - Get all products with filtering
- `GET /api/admin/reviews` - Get all reviews with filtering
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/audit-logs` - Get audit logs

### 📝 Orders & Reviews
- `POST /api/orders` - Create new order
- `GET /api/orders/my-orders` - Get user's orders
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/status` - Update order status (Admin)
- `GET /api/reviews/product/:productId` - Get product reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

## 🗄️ Database Schema

### Core Models:
- **User** - Authentication, profiles, roles
- **Product** - Catalog with images, pricing, inventory
- **Order/OrderItem** - Order management system
- **Payment** - Payment processing and tracking
- **Shipment** - Shipping and tracking
- **Review** - Product reviews and ratings
- **Notification** - Real-time notifications
- **InventoryLog** - Stock movement tracking
- **AuditLog** - System activity logging

### New Models in v2.0:
- **Payment** - Stripe/PayPal integration
- **Shipment** - Multi-carrier tracking
- **Notification** - Real-time alerts
- **InventoryLog** - Stock management
- **Discount** - Promotional codes
- **AuditLog** - Activity tracking

## 🔐 Security Features

- **JWT Authentication** - Secure token-based auth
- **Role-based Access Control** - Admin/Customer permissions
- **Rate Limiting** - API abuse prevention
- **CORS Protection** - Cross-origin security
- **Helmet Security** - HTTP header protection
- **Input Validation** - Express-validator integration
- **SQL Injection Protection** - Prisma ORM
- **XSS Protection** - Input sanitization

## 📊 Analytics & Reporting

### Dashboard Metrics:
- Total users, orders, products, revenue
- Daily/weekly/monthly trends
- Order status distribution
- Payment method breakdown
- Customer lifetime value
- Product performance metrics
- Inventory status and alerts
- Shipping analytics

### Real-time Features:
- Live order updates
- Stock level monitoring
- Customer activity tracking
- System performance metrics
- Notification delivery status

## 🔌 Real-time Features

### Socket.IO Events:
- `join` - User authentication
- `new_notification` - Real-time notifications
- `admin_notification` - Admin broadcasts
- `broadcast_message` - System announcements
- `order_update` - Order status changes
- `payment_update` - Payment status changes
- `shipment_update` - Shipping updates

### Notification Types:
- Order confirmations
- Payment notifications
- Shipping updates
- Review reminders
- Promotional messages
- System alerts

## 💳 Payment Integration

### Stripe Features:
- Payment intents
- Webhook handling
- Refund processing
- Customer management
- Payment method storage
- Dispute handling

### PayPal Features:
- Express checkout
- Subscription billing
- Refund processing
- Webhook integration

## 📦 Shipping Integration

### Supported Carriers:
- UPS
- FedEx
- USPS
- DHL

### Features:
- Real-time tracking
- Delivery notifications
- Shipping cost calculation
- Label generation
- Delivery confirmation

## 🚀 Deployment

### Production Environment:
```env
NODE_ENV=production
DATABASE_URL=your-production-database-url
JWT_SECRET=your-secure-jwt-secret
STRIPE_SECRET_KEY=sk_live_your_live_key
CLOUDINARY_CLOUD_NAME=your-production-cloud
```

### Deployment Steps:
1. Set up production database
2. Configure environment variables
3. Run database migrations
4. Build TypeScript code
5. Deploy to hosting platform
6. Set up webhooks
7. Configure SSL certificates

## 🧪 Testing

### API Testing:
```bash
# Health check
curl http://localhost:5000/health

# Get products
curl http://localhost:5000/api/products

# Test Socket.IO connection
# Use Socket.IO client or browser console
```

### Sample API Calls:

**Register User:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Create Payment Intent:**
```bash
curl -X POST http://localhost:5000/api/payment/create-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 29.99,
    "currency": "usd",
    "orderId": "order_id_here"
  }'
```

## 📝 Scripts

- `yarn dev` - Start development server with TypeScript
- `yarn build` - Build TypeScript to JavaScript
- `yarn start` - Start production server
- `yarn db:generate` - Generate Prisma client
- `yarn db:push` - Push schema to database
- `yarn db:migrate` - Create and run migrations
- `yarn db:seed` - Seed database with sample data
- `yarn db:studio` - Open Prisma Studio

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Email: support@licoriceropes.com
- Phone: +1 (555) 123-4567
- Documentation: `/api/docs`

---

**Built with ❤️ and TypeScript for Licorice Ropes E-commerce v2.0**

## 🔄 Migration from v1.0

If upgrading from v1.0:

1. **Backup your database**
2. **Update environment variables**
3. **Run new migrations**
4. **Update frontend API calls**
5. **Test payment integration**
6. **Configure webhooks**
7. **Update Socket.IO client**

### Breaking Changes:
- API response format updates
- New authentication requirements
- Payment flow changes
- Notification system updates
- Admin dashboard restructure







