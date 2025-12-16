const { pool } = require('../config/database');

// 辅助函数：从地址中提取区域代码
function extractDistrictCode(address) {
  const districtMappings = {
    '黄浦区': '310101',
    '徐汇区': '310104', 
    '长宁区': '310105',
    '静安区': '310106',
    '普陀区': '310107',
    '虹口区': '310109',
    '杨浦区': '310110',
    '浦东新区': '310115',
    '闵行区': '310112',
    '宝山区': '310113',
    '嘉定区': '310114',
    '松江区': '310117',
    '青浦区': '310118',
    '奉贤区': '310120',
    '金山区': '310116',
    '崇明区': '310151'
  };

  for (const [district, code] of Object.entries(districtMappings)) {
    if (address.includes(district)) {
      return code;
    }
  }

  return null; // 无法识别区域
}

// 提交社区反馈
const submitCommunityFeedback = async (req, res) => {
  try {
    const { longitude, latitude, formatted_address, district_code, score, content, resident_type } = req.body;

    // 如果没有提供区域代码，尝试从地址提取
    const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

    // 首先创建或获取位置
    let location_id;
    
    // 检查位置是否已存在
    const [existingLocation] = await pool.execute(`
      SELECT location_id FROM locations 
      WHERE formatted_address = ? AND longitude = ? AND latitude = ?
    `, [formatted_address, longitude, latitude]);

    if (existingLocation.length > 0) {
      location_id = existingLocation[0].location_id;
    } else {
      // 创建新位置
      const [locationResult] = await pool.execute(`
        INSERT INTO locations (formatted_address, longitude, latitude, district_code)
        VALUES (?, ?, ?, ?)
      `, [formatted_address, longitude, latitude, finalDistrictCode]);
      
      location_id = locationResult.insertId;
    }

    // 然后插入反馈基表
    const [baseResult] = await pool.execute(`
      INSERT INTO feedback_base (user_id, feedback_type, score, content)
      VALUES (?, 'community', ?, ?)
    `, [req.user.user_id, score, content || null]);

    const feedback_id = baseResult.insertId;

    // 最后插入社区反馈表
    await pool.execute(`
      INSERT INTO community_feedback (feedback_id, location_id, resident_type)
      VALUES (?, ?, ?)
    `, [feedback_id, location_id, resident_type || null]);

    res.status(201).json({
      success: true,
      message: '社区反馈提交成功',
      data: { feedback_id }
    });

  } catch (error) {
    console.error('提交社区反馈错误:', error);
    res.status(500).json({
      success: false,
      message: '反馈提交失败，请稍后重试'
    });
  }
};

// 获取社区反馈列表
const getCommunityFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 10, address, user_id } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE fb.feedback_type = "community"';
    let params = [];

    // 按地址筛选
    if (address) {
      whereClause += ' AND l.formatted_address LIKE ?';
      params.push(`%${address}%`);
    }

    // 按用户筛选（管理员可查看所有，用户只能查看自己的）
    if (user_id && (req.user.role === 'admin' || req.user.user_id == user_id)) {
      whereClause += ' AND fb.user_id = ?';
      params.push(user_id);
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND fb.user_id = ?';
      params.push(req.user.user_id);
    }

    const [feedbacks] = await pool.execute(`
      SELECT 
        fb.feedback_id,
        fb.user_id,
        fb.score,
        fb.submitted_at,
        fb.content,
        l.formatted_address,
        l.longitude,
        l.latitude,
        l.district_code,
        cf.resident_type,
        u.username
      FROM feedback_base fb
      JOIN community_feedback cf ON fb.feedback_id = cf.feedback_id
      JOIN locations l ON cf.location_id = l.location_id
      JOIN users u ON fb.user_id = u.user_id
      ${whereClause}
      ORDER BY fb.submitted_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM feedback_base fb
      JOIN community_feedback cf ON fb.feedback_id = cf.feedback_id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取社区反馈错误:', error);
    res.status(500).json({
      success: false,
      message: '获取反馈列表失败'
    });
  }
};

// 提交设施反馈
const submitFacilityFeedback = async (req, res) => {
  try {
    const { 
      facility_id, 
      score, 
      content, 
      // 如果没有 facility_id，则需要以下字段创建新设施
      facility_name, 
      category_code, 
      longitude, 
      latitude, 
      formatted_address,
      district_code 
    } = req.body;

    let actualFacilityId = facility_id;
    
    // 如果没有提供 facility_id，则创建新设施
    if (!facility_id) {
      if (!facility_name || !category_code || !longitude || !latitude || !formatted_address) {
        return res.status(400).json({
          success: false,
          message: '创建新设施时需要提供设施名称、分类、坐标和地址信息'
        });
      }

      // 提取区域代码（如果没有提供）
      const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

      // 首先创建或获取位置
      let locationId;
      const [existingLocation] = await pool.execute(
        'SELECT location_id FROM locations WHERE longitude = ? AND latitude = ?',
        [longitude, latitude]
      );

      if (existingLocation.length > 0) {
        locationId = existingLocation[0].location_id;
      } else {
        const [locationResult] = await pool.execute(
          'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
          [formatted_address, longitude, latitude, finalDistrictCode]
        );
        locationId = locationResult.insertId;
      }

      // 检查是否已存在相同设施
      const [existingFacility] = await pool.execute(
        'SELECT facility_id FROM facilities WHERE name = ? AND location_id = ? AND category_code = ?',
        [facility_name, locationId, category_code]
      );

      if (existingFacility.length > 0) {
        actualFacilityId = existingFacility[0].facility_id;
      } else {
        // 创建新设施
        const [facilityResult] = await pool.execute(
          'INSERT INTO facilities (name, location_id, category_code) VALUES (?, ?, ?)',
          [facility_name, locationId, category_code]
        );
        actualFacilityId = facilityResult.insertId;
      }
    }

    // 首先插入反馈基表
    const [baseResult] = await pool.execute(`
      INSERT INTO feedback_base (user_id, feedback_type, score, content)
      VALUES (?, 'facility', ?, ?)
    `, [req.user.user_id, score, content || null]);

    const feedback_id = baseResult.insertId;

    // 然后插入设施反馈表
    await pool.execute(`
      INSERT INTO facility_feedback (feedback_id, facility_id)
      VALUES (?, ?)
    `, [feedback_id, actualFacilityId]);

    res.status(201).json({
      success: true,
      message: '设施反馈提交成功',
      data: { feedback_id, facility_id: actualFacilityId }
    });

  } catch (error) {
    console.error('提交设施反馈错误:', error);
    res.status(500).json({
      success: false,
      message: '设施反馈提交失败，请稍后重试'
    });
  }
};

// 获取设施反馈列表
const getFacilityFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 10, facility_id, user_id } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE fb.feedback_type = "facility"';
    let params = [];

    // 按设施筛选
    if (facility_id) {
      whereClause += ' AND ff.facility_id = ?';
      params.push(facility_id);
    }

    // 按用户筛选（管理员可查看所有，用户只能查看自己的）
    if (user_id && (req.user.role === 'admin' || req.user.user_id == user_id)) {
      whereClause += ' AND fb.user_id = ?';
      params.push(user_id);
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND fb.user_id = ?';
      params.push(req.user.user_id);
    }

    const [feedbacks] = await pool.execute(`
      SELECT 
        fb.feedback_id,
        fb.user_id,
        fb.score,
        fb.submitted_at,
        fb.content,
        ff.facility_id,
        f.name as facility_name,
        l.formatted_address as facility_address,
        l.longitude,
        l.latitude,
        l.district_code,
        u.username
      FROM feedback_base fb
      JOIN facility_feedback ff ON fb.feedback_id = ff.feedback_id
      JOIN facilities f ON ff.facility_id = f.facility_id
      JOIN locations l ON f.location_id = l.location_id
      JOIN users u ON fb.user_id = u.user_id
      ${whereClause}
      ORDER BY fb.submitted_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM feedback_base fb
      JOIN facility_feedback ff ON fb.feedback_id = ff.feedback_id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取设施反馈错误:', error);
    res.status(500).json({
      success: false,
      message: '获取反馈列表失败'
    });
  }
};

// 删除反馈（仅管理员或反馈提交者）
const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查权限
    const [feedback] = await pool.execute(`
      SELECT user_id FROM feedback_base WHERE feedback_id = ?
    `, [id]);

    if (feedback.length === 0) {
      return res.status(404).json({
        success: false,
        message: '反馈不存在'
      });
    }

    if (req.user.role !== 'admin' && feedback[0].user_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: '无权限删除此反馈'
      });
    }

    // 删除反馈（级联删除会自动删除子表记录）
    await pool.execute(`
      DELETE FROM feedback_base WHERE feedback_id = ?
    `, [id]);

    res.json({
      success: true,
      message: '反馈删除成功'
    });

  } catch (error) {
    console.error('删除反馈错误:', error);
    res.status(500).json({
      success: false,
      message: '删除反馈失败'
    });
  }
};

// 获取反馈统计
const getFeedbackStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereClause = '';
    let params = [];

    if (start_date && end_date) {
      whereClause = 'WHERE submitted_at BETWEEN ? AND ?';
      params = [start_date, end_date];
    }

    const [stats] = await pool.execute(`
      SELECT 
        feedback_type,
        AVG(score) as avg_score,
        COUNT(*) as total_count,
        COUNT(CASE WHEN score >= 4 THEN 1 END) as positive_count,
        COUNT(CASE WHEN score <= 2 THEN 1 END) as negative_count
      FROM feedback_base
      ${whereClause}
      GROUP BY feedback_type
    `, params);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取反馈统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
};

module.exports = {
  submitCommunityFeedback,
  getCommunityFeedback,
  submitFacilityFeedback,
  getFacilityFeedback,
  deleteFeedback,
  getFeedbackStats
};
