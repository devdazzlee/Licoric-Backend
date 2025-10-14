"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const users_1 = __importDefault(require("./routes/users"));
const cart_1 = __importDefault(require("./routes/cart"));
const favorites_1 = __importDefault(require("./routes/favorites"));
const orders_1 = __importDefault(require("./routes/orders"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const contact_1 = __importDefault(require("./routes/contact"));
const admin_1 = __importDefault(require("./routes/admin"));
const payment_1 = __importDefault(require("./routes/payment"));
const shipment_1 = __importDefault(require("./routes/shipment"));
const shippo_1 = __importDefault(require("./routes/shippo"));
const notification_1 = __importDefault(require("./routes/notification"));
const categories_1 = __importDefault(require("./routes/categories"));
const discounts_1 = __importDefault(require("./routes/discounts"));
const newsletter_1 = __importDefault(require("./routes/newsletter"));
const addresses_1 = __importDefault(require("./routes/addresses"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const flavors_1 = __importDefault(require("./routes/flavors"));
const returns_1 = __importDefault(require("./routes/returns"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const errorHandler_1 = require("./middleware/errorHandler");
const notFound_1 = require("./middleware/notFound");
const socketService_1 = require("./services/socketService");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true
    }
});
const PORT = process.env.PORT || 5000;
const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(limiter);
app.use((0, morgan_1.default)('combined'));
app.use((0, cookie_parser_1.default)());
app.use('/api/payment/webhook', express_1.default.raw({ type: 'application/json' }));
app.use('/api/shippo/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: '2.0.0',
        features: {
            typescript: true,
            cookies: true,
            refreshTokens: true,
            socketIO: true,
            payments: true,
            shipments: true,
            notifications: true
        }
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/products', products_1.default);
app.use('/api/users', users_1.default);
app.use('/api/cart', cart_1.default);
app.use('/api/favorites', favorites_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/reviews', reviews_1.default);
app.use('/api/contact', contact_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/payment', payment_1.default);
app.use('/api/shipment', shipment_1.default);
app.use('/api/shippo', shippo_1.default);
app.use('/api/notifications', notification_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/discounts', discounts_1.default);
app.use('/api/newsletter', newsletter_1.default);
app.use('/api/addresses', addresses_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/flavors', flavors_1.default);
app.use('/api/returns', returns_1.default);
app.use('/api/invoices', invoices_1.default);
app.get('/', (req, res) => {
    res.json({
        message: 'Licorice Ropes API v2.0 - TypeScript Edition',
        version: '2.0.0',
        features: [
            'Full TypeScript Support',
            'ES6 Imports',
            'HTTP Cookies for Auth',
            'Access & Refresh Tokens',
            'Payment Integration (Stripe/PayPal)',
            'Shipment Tracking',
            'Real-time Notifications (Socket.IO)',
            'Advanced Admin Dashboard',
            'Inventory Management',
            'Analytics & Reporting'
        ],
        authentication: {
            type: 'JWT with HTTP Cookies',
            accessToken: '15 minutes',
            refreshToken: '7 days',
            cookieOptions: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            }
        },
        documentation: '/api/docs',
        health: '/health'
    });
});
(0, socketService_1.setupSocketHandlers)(io);
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
server.listen(PORT, () => {
    console.log('🚀 ====================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log('🚀 ====================================');
    console.log('✅ TypeScript: Enabled');
    console.log('✅ ES6 Imports: Enabled');
    console.log('✅ HTTP Cookies: Enabled');
    console.log('✅ Access & Refresh Tokens: Enabled');
    console.log('✅ Socket.IO: Enabled');
    console.log('✅ Payment Integration: Ready');
    console.log('✅ Shipment Tracking: Active');
    console.log('✅ Advanced Analytics: Available');
    console.log('🚀 ====================================');
});
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
    });
});
exports.default = app;
//# sourceMappingURL=server.js.map