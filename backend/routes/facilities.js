const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facilityController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 公开路由（不需要认证）
router.get('/categories', facilityController.getFacilityCategories);
router.get('/search', facilityController.getFacilities);
router.get('/map-search', facilityController.searchMapFacilities);
router.get('/stats', facilityController.getFacilityStats);

// 需要认证的路由
router.use(authenticateToken);

// 获取设施列表（带评价统计）
router.get('/with-feedback', facilityController.getFacilitiesWithFeedback);

// 获取单个设施详情
router.get('/:id', facilityController.getFacilityById);

// 管理员专用路由
router.post('/', requireAdmin, facilityController.createFacility);
router.post('/import', requireAdmin, facilityController.importPOIData);
router.put('/:id', requireAdmin, facilityController.updateFacility);
router.delete('/:id', requireAdmin, facilityController.deleteFacility);

module.exports = router;
