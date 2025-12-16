const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { validate, evaluationSchema } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');

// 所有评估路由都需要认证
router.use(authenticateToken);

// 创建评估任务
router.post('/', validate(evaluationSchema), evaluationController.createEvaluationTask);

// 获取评估任务列表
router.get('/', evaluationController.getEvaluationTasks);

// 获取评估统计数据
router.get('/stats', evaluationController.getEvaluationStats);

// 获取评估任务详情
router.get('/:id', evaluationController.getEvaluationTaskDetails);

// 获取评估结果详情
router.get('/:id/result', evaluationController.getEvaluationResult);

// 删除评估任务
router.delete('/:id', evaluationController.deleteEvaluationTask);

module.exports = router;
