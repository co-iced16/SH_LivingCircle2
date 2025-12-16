const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, registerSchema, loginSchema } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');

// 用户注册
router.post('/register', validate(registerSchema), authController.register);

// 用户登录
router.post('/login', validate(loginSchema), authController.login);

// 获取当前用户信息（需要认证）
router.get('/profile', authenticateToken, authController.getProfile);

// 更新用户信息（需要认证）
router.put('/profile', authenticateToken, authController.updateProfile);

// 修改密码（需要认证）
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
