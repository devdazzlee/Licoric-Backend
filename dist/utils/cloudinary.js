"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = exports.deleteFromCloudinary = exports.uploadMultipleToCloudinary = exports.uploadToCloudinary = exports.upload = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const multer_1 = __importDefault(require("multer"));
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});
const uploadToCloudinary = async (file) => {
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary_1.v2.uploader.upload_stream({
                resource_type: 'auto',
                folder: 'licorice-ropes',
                transformation: [
                    { width: 800, height: 800, crop: 'limit', quality: 'auto' },
                    { format: 'auto' }
                ]
            }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result);
            }).end(file.buffer);
        });
        return result.secure_url;
    }
    catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image');
    }
};
exports.uploadToCloudinary = uploadToCloudinary;
const uploadMultipleToCloudinary = async (files) => {
    try {
        const uploadPromises = files.map(file => (0, exports.uploadToCloudinary)(file));
        const results = await Promise.all(uploadPromises);
        return results;
    }
    catch (error) {
        console.error('Multiple upload error:', error);
        throw new Error('Failed to upload images');
    }
};
exports.uploadMultipleToCloudinary = uploadMultipleToCloudinary;
const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        return result;
    }
    catch (error) {
        console.error('Cloudinary delete error:', error);
        throw new Error('Failed to delete image');
    }
};
exports.deleteFromCloudinary = deleteFromCloudinary;
//# sourceMappingURL=cloudinary.js.map