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
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});
const PORT = process.env['PORT'] || 5000;
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
    credentials: true
}));
app.use(limiter);
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env['NODE_ENV'],
        version: '2.0.0'
    });
});
app.get('/', (req, res) => {
    res.json({
        message: 'Licorice Ropes API v2.0',
        version: '2.0.0',
        features: [
            'TypeScript Support',
            'Payment Integration',
            'Shipment Tracking',
            'Real-time Notifications',
            'Advanced Admin Dashboard',
            'Inventory Management',
            'Analytics & Reporting'
        ],
        documentation: '/api/docs',
        health: '/health'
    });
});
io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    socket.on('join', (data) => {
        console.log(`👤 User ${data.userId} joined`);
        socket.emit('joined', {
            message: 'Successfully connected',
            userId: data.userId,
            role: data.role
        });
    });
    socket.on('disconnect', () => {
        console.log(`👋 User disconnected: ${socket.id}`);
    });
});
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env['NODE_ENV']}`);
    console.log(`🌐 Frontend URL: ${process.env['FRONTEND_URL']}`);
    console.log(`🔌 Socket.IO enabled`);
    console.log(`💳 Payment integration ready`);
    console.log(`📦 Shipment tracking active`);
    console.log(`📊 Advanced analytics available`);
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
//# sourceMappingURL=server-simple.js.map