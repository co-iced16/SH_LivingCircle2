const { pool } = require('../config/database');
const { geocode, reverseGeocode } = require('../utils/map');

// 保存位置信息到 locations 表
const saveLocationInfo = async (req, res) => {
  try {
    const { 
      longitude, 
      latitude, 
      formatted_address,
      district_code,
      province,
      city,
      district,
      township
    } = req.body;

    // 验证必需参数
    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: '经纬度参数必填'
      });
    }

    // 如果没有地址信息，进行逆地理编码
    let address = formatted_address;
    let districtCode = district_code;
    
    if (!address) {
      console.log('进行高德地图反编码...', longitude, latitude);
      const geocodeResult = await reverseGeocode(longitude, latitude);
      if (geocodeResult.success) {
        address = geocodeResult.formatted_address;
        districtCode = geocodeResult.district || null;
        console.log('反编码成功:', address);
      } else {
        address = `${longitude}, ${latitude}`;
        console.log('反编码失败，使用坐标作为地址');
      }
    }

    // 检查是否已存在相同坐标的位置（避免重复，误差范围0.000001约等于0.1米）
    const checkQuery = `
      SELECT location_id, formatted_address FROM locations 
      WHERE ABS(longitude - ?) < 0.000001 AND ABS(latitude - ?) < 0.000001
      LIMIT 1
    `;
    
    const [existingRows] = await pool.execute(checkQuery, [longitude, latitude]);
    
    if (existingRows.length > 0) {
      // 返回已存在的位置信息
      return res.json({
        success: true,
        data: {
          location_id: existingRows[0].location_id,
          longitude,
          latitude,
          formatted_address: existingRows[0].formatted_address,
          district_code: districtCode,
          isExisting: true
        },
        message: '位置信息已存在'
      });
    }

    // 保存新位置信息到数据库
    const insertQuery = `
      INSERT INTO locations (
        formatted_address, 
        longitude, 
        latitude, 
        district_code
      ) VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.execute(insertQuery, [
      address,
      longitude,
      latitude,
      districtCode || district || null
    ]);

    // 返回包含详细信息的响应
    res.json({
      success: true,
      data: {
        location_id: result.insertId,
        longitude,
        latitude,
        formatted_address: address,
        district_code: districtCode || district || null,
        // 返回额外的地理信息供前端使用
        province: province || null,
        city: city || null,
        district: district || null,
        township: township || null,
        isExisting: false
      },
      message: '位置信息保存成功'
    });

  } catch (error) {
    console.error('保存位置信息错误:', error);
    res.status(500).json({
      success: false,
      message: '保存位置信息失败: ' + error.message
    });
  }
};

// 根据location_id获取位置信息
const getLocationInfo = async (req, res) => {
  try {
    const { location_id } = req.params;

    if (!location_id) {
      return res.status(400).json({
        success: false,
        message: '位置ID必填'
      });
    }

    const query = `
      SELECT 
        location_id,
        formatted_address,
        longitude,
        latitude,
        district_code
      FROM locations 
      WHERE location_id = ?
    `;

    const [rows] = await pool.execute(query, [location_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '位置信息不存在'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('获取位置信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取位置信息失败'
    });
  }
};

// 根据坐标查找位置信息
const findLocationByCoords = async (req, res) => {
  try {
    const { longitude, latitude } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: '经纬度参数必填'
      });
    }

    // 查找附近的位置（误差范围内）
    const query = `
      SELECT 
        location_id,
        formatted_address,
        longitude,
        latitude,
        district_code,
        SQRT(POW(111.32 * (longitude - ?), 2) + POW(110.57 * (latitude - ?), 2)) as distance
      FROM locations 
      WHERE ABS(longitude - ?) < 0.001 AND ABS(latitude - ?) < 0.001
      ORDER BY distance ASC
      LIMIT 1
    `;

    const [rows] = await pool.execute(query, [
      longitude, latitude, longitude, latitude
    ]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: '未找到匹配的位置信息'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('查找位置信息错误:', error);
    res.status(500).json({
      success: false,
      message: '查找位置信息失败'
    });
  }
};

// 地理编码
const performGeocode = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: '地址参数必填'
      });
    }

    const result = await geocode(address);
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('地理编码错误:', error);
    res.status(500).json({
      success: false,
      message: '地理编码服务异常'
    });
  }
};

// 逆地理编码
const performReverseGeocode = async (req, res) => {
  try {
    const { longitude, latitude } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: '经纬度参数必填'
      });
    }

    const result = await reverseGeocode(parseFloat(longitude), parseFloat(latitude));
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('逆地理编码错误:', error);
    res.status(500).json({
      success: false,
      message: '逆地理编码服务异常'
    });
  }
};

module.exports = {
  saveLocationInfo,
  getLocationInfo,
  findLocationByCoords,
  performGeocode,
  performReverseGeocode
};
