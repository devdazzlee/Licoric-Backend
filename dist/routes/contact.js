"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const contactController_1 = require("../controllers/contactController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const contactValidation = [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
];
router.post('/', contactValidation, contactController_1.createContactMessage);
router.get('/', auth_1.auth, auth_1.adminAuth, contactController_1.getContactMessages);
router.put('/:id', auth_1.auth, auth_1.adminAuth, contactController_1.updateContactMessage);
router.delete('/:id', auth_1.auth, auth_1.adminAuth, contactController_1.deleteContactMessage);
exports.default = router;
//# sourceMappingURL=contact.js.map