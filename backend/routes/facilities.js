const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facilityController');
const { validate, facilitySchema } = require('../utils/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 公开路由（不需要认证）
router.get('/categories', facilityController.getFacilityCategories);
router.get('/search', facilityController.getFacilities);
// router.get('/map-search', facilityController.searchMapFacilities); // 暂时注释
// router.get('/stats', facilityController.getFacilityStats); // 暂时注释
// router.get('/:id', facilityController.getFacilityById); // 暂时注释

// 需要认证的路由
router.use(authenticateToken);

// 管理员专用路由（暂时注释，只保留基本搜索功能）
// router.post('/', requireAdmin, validate(facilitySchema), facilityController.createFacility);
// router.post('/import', requireAdmin, facilityController.importPOIData);
// router.put('/:id', requireAdmin, validate(facilitySchema), facilityController.updateFacility);
// router.delete('/:id', requireAdmin, facilityController.deleteFacility);

module.exports = router;
