const express = require('express');
const router = express.Router();
const { testFacilities } = require('../controllers/testController');

// 测试路由
router.get('/facilities', testFacilities);

module.exports = router;
