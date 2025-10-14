"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/profile/me', auth_1.auth, userController_1.getMyProfile);
router.put('/profile/me', auth_1.auth, userController_1.updateMyProfile);
router.patch('/profile/image', auth_1.auth, userController_1.updateProfileImage);
router.put('/profile/password', auth_1.auth, userController_1.changePassword);
router.get('/', auth_1.auth, auth_1.adminAuth, userController_1.getUsers);
router.get('/:id', auth_1.auth, auth_1.adminAuth, userController_1.getUser);
router.put('/:id', auth_1.auth, auth_1.adminAuth, userController_1.updateUser);
router.delete('/:id', auth_1.auth, auth_1.adminAuth, userController_1.deleteUser);
exports.default = router;
//# sourceMappingURL=users.js.map