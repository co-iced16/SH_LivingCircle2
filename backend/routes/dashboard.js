const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getDashboardStats,
  getRecentActivities
} = require('../controllers/dashboardController');

// 所有路由需要认证
router.use(authenticateToken);

// 获取首页统计数据
router.get('/stats', getDashboardStats);

// 获取最近活动
router.get('/activities', getRecentActivities);

module.exports = router;
