const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  createReport,
  getReports,
  getReportDetails,
  generateDeficiencyAnalysis,
  deleteReport,
  getEvaluationTaskDateRange
} = require('../controllers/reportController');

// 所有路由需要认证
router.use(authenticateToken);

// 获取评估任务日期范围（辅助接口）
router.get('/task-date-range', getEvaluationTaskDateRange);

// 获取报告列表
router.get('/', getReports);

// 获取报告详情
router.get('/:id', getReportDetails);

// 创建报告（仅管理员）
router.post('/', requireAdmin, createReport);

// 生成短板分析（仅管理员）
router.post('/:report_id/analyze', requireAdmin, generateDeficiencyAnalysis);

// 删除报告（仅管理员）
router.delete('/:id', requireAdmin, deleteReport);

module.exports = router;

