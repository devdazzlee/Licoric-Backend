"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    console.error(err);
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = { message, statusCode: 404, name: 'CastError' };
    }
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { message, statusCode: 400, name: 'DuplicateKeyError' };
    }
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map((val) => val.message).join(', ');
        error = { message, statusCode: 400, name: 'ValidationError' };
    }
    if (err.code === 'P2002') {
        const message = 'A record with this data already exists';
        error = { message, statusCode: 400, name: 'PrismaError' };
    }
    if (err.code === 'P2025') {
        const message = 'Record not found';
        error = { message, statusCode: 404, name: 'PrismaError' };
    }
    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error',
        ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
exports.default = exports.errorHandler;
//# sourceMappingURL=errorHandler.js.map