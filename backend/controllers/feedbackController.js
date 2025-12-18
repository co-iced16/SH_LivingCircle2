const { pool } = require('../config/database');
const { validateAndMapCategoryCode } = require('../utils/categoryMapping');

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

    // 验证坐标范围
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: '经度必须在-180到180之间',
        error_code: 'INVALID_LONGITUDE'
      });
    }

    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: '纬度必须在-90到90之间',
        error_code: 'INVALID_LATITUDE'
      });
    }

    // 验证地址
    if (!formatted_address || typeof formatted_address !== 'string' || formatted_address.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: '地址至少需要5个字符',
        error_code: 'INVALID_ADDRESS'
      });
    }

    // 验证评分
    if (typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
      return res.status(400).json({
        success: false,
        message: '评分必须是1到5之间的整数',
        error_code: 'INVALID_SCORE'
      });
    }

    // 如果没有提供区域代码，尝试从地址提取
    const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

    // 使用事务确保数据一致性
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 首先创建或获取位置
      let location_id;
      
      // 检查位置是否已存在（使用更精确的匹配）
      const [existingLocation] = await connection.execute(`
        SELECT location_id FROM locations 
        WHERE ABS(longitude - ?) < 0.000001 AND ABS(latitude - ?) < 0.000001
        LIMIT 1
      `, [longitude, latitude]);

      if (existingLocation.length > 0) {
        location_id = existingLocation[0].location_id;
      } else {
        // 创建新位置
        const [locationResult] = await connection.execute(`
          INSERT INTO locations (formatted_address, longitude, latitude, district_code)
          VALUES (?, ?, ?, ?)
        `, [formatted_address.trim(), longitude, latitude, finalDistrictCode]);
        
        location_id = locationResult.insertId;
      }

      // 然后插入反馈基表
      const [baseResult] = await connection.execute(`
        INSERT INTO feedback_base (user_id, feedback_type, score, content)
        VALUES (?, 'community', ?, ?)
      `, [req.user.user_id, score, content ? content.trim().substring(0, 1000) : null]);

      const feedback_id = baseResult.insertId;

      // 最后插入社区反馈表
      await connection.execute(`
        INSERT INTO community_feedback (feedback_id, location_id, resident_type)
        VALUES (?, ?, ?)
      `, [feedback_id, location_id, resident_type || null]);

      await connection.commit();

      res.status(201).json({
        success: true,
        message: '社区反馈提交成功',
        data: { feedback_id }
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('提交社区反馈错误:', error);
    
    // 处理特定错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: '反馈已存在',
        error_code: 'DUPLICATE_FEEDBACK'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '反馈提交失败，请稍后重试',
      error_code: 'INTERNAL_ERROR'
    });
  }
};

// 获取社区反馈列表
const getCommunityFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 10, address, user_id } = req.query;
    
    // 验证和规范化分页参数
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10)); // 限制最大100
    const offset = (pageNum - 1) * limitNum;

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
    `, [...params, limitNum, offset]);

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
          page: pageNum,
          limit: limitNum,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limitNum)
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
          message: '创建新设施时需要提供设施名称、分类、坐标和地址信息',
          error_code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // 验证坐标范围
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return res.status(400).json({
          success: false,
          message: '坐标范围无效：经度应在-180到180之间，纬度应在-90到90之间',
          error_code: 'INVALID_COORDINATES'
        });
      }

      // 验证并映射分类代码
      const categoryValidation = await validateAndMapCategoryCode(category_code);
      
      if (!categoryValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: `无效的设施分类代码: ${category_code}。请从有效分类中选择。`,
          error_code: 'INVALID_CATEGORY_CODE'
        });
      }

      // 使用映射后的分类代码
      const finalCategoryCode = categoryValidation.mappedCode;

      // 提取区域代码（如果没有提供）
      const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

      // 使用事务确保数据一致性
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // 首先创建或获取位置
        let locationId;
        const [existingLocation] = await connection.execute(
          'SELECT location_id FROM locations WHERE longitude = ? AND latitude = ?',
          [longitude, latitude]
        );

        if (existingLocation.length > 0) {
          locationId = existingLocation[0].location_id;
        } else {
          const [locationResult] = await connection.execute(
            'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
            [formatted_address, longitude, latitude, finalDistrictCode]
          );
          locationId = locationResult.insertId;
        }

        // 检查是否已存在相同设施（使用映射后的分类代码）
        const [existingFacility] = await connection.execute(
          'SELECT facility_id FROM facilities WHERE name = ? AND location_id = ? AND category_code = ?',
          [facility_name, locationId, finalCategoryCode]
        );

        if (existingFacility.length > 0) {
          actualFacilityId = existingFacility[0].facility_id;
        } else {
          // 创建新设施（使用映射后的分类代码）
          const [facilityResult] = await connection.execute(
            'INSERT INTO facilities (name, location_id, category_code) VALUES (?, ?, ?)',
            [facility_name, locationId, finalCategoryCode]
          );
          actualFacilityId = facilityResult.insertId;
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    // 验证设施是否存在
    if (actualFacilityId) {
      const [facilityCheck] = await pool.execute(
        'SELECT facility_id FROM facilities WHERE facility_id = ?',
        [actualFacilityId]
      );
      if (facilityCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: '指定的设施不存在',
          error_code: 'FACILITY_NOT_FOUND'
        });
      }
    }

    // 使用事务确保反馈数据一致性
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 首先插入反馈基表
      const [baseResult] = await connection.execute(`
        INSERT INTO feedback_base (user_id, feedback_type, score, content)
        VALUES (?, 'facility', ?, ?)
      `, [req.user.user_id, score, content || null]);

      const feedback_id = baseResult.insertId;

      // 然后插入设施反馈表
      await connection.execute(`
        INSERT INTO facility_feedback (feedback_id, facility_id)
        VALUES (?, ?)
      `, [feedback_id, actualFacilityId]);

      await connection.commit();

      res.status(201).json({
        success: true,
        message: '设施反馈提交成功',
        data: { feedback_id, facility_id: actualFacilityId }
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('提交设施反馈错误:', error);
    
    // 提供更具体的错误信息
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: '提交失败：使用了无效的设施分类代码',
        error_code: 'INVALID_CATEGORY_CODE'
      });
    }
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: '反馈已存在',
        error_code: 'DUPLICATE_FEEDBACK'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '设施反馈提交失败，请稍后重试',
      error_code: 'INTERNAL_ERROR'
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

    // 按设施筛选 - 如果指定了设施ID，管理员可以查看该设施所有反馈
    if (facility_id) {
      whereClause += ' AND ff.facility_id = ?';
      params.push(facility_id);
      // 管理员可以查看指定设施的所有反馈
      if (req.user.role !== 'admin') {
        // 普通用户只能看自己的
        whereClause += ' AND fb.user_id = ?';
        params.push(req.user.user_id);
      }
    } else {
      // 没有指定设施时，按用户筛选
      if (user_id && (req.user.role === 'admin' || req.user.user_id == user_id)) {
        whereClause += ' AND fb.user_id = ?';
        params.push(user_id);
      } else if (req.user.role !== 'admin') {
        whereClause += ' AND fb.user_id = ?';
        params.push(req.user.user_id);
      }
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

// 获取所有反馈（管理员专用，包含社区反馈和设施反馈）
const getAllFeedbacks = async (req, res) => {
  try {
    // 验证管理员权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以查看所有反馈'
      });
    }

    const { page = 1, limit = 10, feedback_type, keyword } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // 按反馈类型筛选
    if (feedback_type && (feedback_type === 'community' || feedback_type === 'facility')) {
      whereClause += ' AND fb.feedback_type = ?';
      params.push(feedback_type);
    }

    // 按关键词搜索（用户名、内容、地址）
    if (keyword) {
      whereClause += ` AND (
        u.username LIKE ? OR 
        fb.content LIKE ? OR
        COALESCE(l_community.formatted_address, '') LIKE ? OR
        COALESCE(l_facility.formatted_address, '') LIKE ? OR
        COALESCE(f.name, '') LIKE ?
      )`;
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }

    // 获取所有反馈（社区反馈和设施反馈合并）
    const [allFeedbacks] = await pool.execute(`
      SELECT 
        fb.feedback_id,
        fb.user_id,
        fb.feedback_type,
        fb.score,
        fb.submitted_at,
        fb.content,
        u.username,
        -- 社区反馈字段
        cf.location_id as community_location_id,
        l_community.formatted_address as community_address,
        l_community.longitude as community_longitude,
        l_community.latitude as community_latitude,
        cf.resident_type,
        -- 设施反馈字段
        ff.facility_id,
        f.name as facility_name,
        l_facility.formatted_address as facility_address
      FROM feedback_base fb
      JOIN users u ON fb.user_id = u.user_id
      LEFT JOIN community_feedback cf ON fb.feedback_id = cf.feedback_id AND fb.feedback_type = 'community'
      LEFT JOIN locations l_community ON cf.location_id = l_community.location_id
      LEFT JOIN facility_feedback ff ON fb.feedback_id = ff.feedback_id AND fb.feedback_type = 'facility'
      LEFT JOIN facilities f ON ff.facility_id = f.facility_id
      LEFT JOIN locations l_facility ON f.location_id = l_facility.location_id
      ${whereClause}
      ORDER BY fb.submitted_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM feedback_base fb
      JOIN users u ON fb.user_id = u.user_id
      LEFT JOIN community_feedback cf ON fb.feedback_id = cf.feedback_id AND fb.feedback_type = 'community'
      LEFT JOIN locations l_community ON cf.location_id = l_community.location_id
      LEFT JOIN facility_feedback ff ON fb.feedback_id = ff.feedback_id AND fb.feedback_type = 'facility'
      LEFT JOIN facilities f ON ff.facility_id = f.facility_id
      LEFT JOIN locations l_facility ON f.location_id = l_facility.location_id
      ${whereClause}
    `, params);

    // 格式化反馈数据
    const formattedFeedbacks = allFeedbacks.map(fb => ({
      feedback_id: fb.feedback_id,
      user_id: fb.user_id,
      username: fb.username,
      feedback_type: fb.feedback_type,
      score: fb.score,
      submitted_at: fb.submitted_at,
      content: fb.content,
      // 根据类型设置地址和相关信息
      address: fb.feedback_type === 'community' 
        ? fb.community_address 
        : fb.facility_address,
      target_name: fb.feedback_type === 'community'
        ? null
        : fb.facility_name,
      // 社区反馈的经纬度
      community_longitude: fb.community_longitude,
      community_latitude: fb.community_latitude,
      resident_type: fb.resident_type,
      facility_id: fb.facility_id
    }));

    res.json({
      success: true,
      data: {
        feedbacks: formattedFeedbacks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('获取所有反馈错误:', error);
    res.status(500).json({
      success: false,
      message: '获取反馈列表失败'
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
  getFeedbackStats,
  getAllFeedbacks
};
