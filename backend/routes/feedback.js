const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { validate, communityFeedbackSchema, facilityFeedbackSchema } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');

// 所有反馈路由都需要认证
router.use(authenticateToken);

// 社区反馈路由
router.post('/community', validate(communityFeedbackSchema), feedbackController.submitCommunityFeedback);
router.get('/community', feedbackController.getCommunityFeedback);

// 设施反馈路由
router.post('/facility', validate(facilityFeedbackSchema), feedbackController.submitFacilityFeedback);
router.get('/facility', feedbackController.getFacilityFeedback);

// 反馈统计
router.get('/stats', feedbackController.getFeedbackStats);

// 获取所有反馈（管理员专用）
router.get('/all', feedbackController.getAllFeedbacks);

// 删除反馈
router.delete('/:id', feedbackController.deleteFeedback);

module.exports = router;
