const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');

// 位置信息管理（注意顺序：具体路径要在参数路径之前）
router.get('/location/find/coords', mapController.findLocationByCoords);
router.post('/location', mapController.saveLocationInfo);
router.get('/location/:location_id', mapController.getLocationInfo);

// 地理编码
router.get('/geocode', mapController.performGeocode);

// 逆地理编码
router.get('/reverse-geocode', mapController.performReverseGeocode);

module.exports = router;
