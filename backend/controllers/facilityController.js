const { pool } = require('../config/database');
const { searchPOI, searchPOIByText, geocode } = require('../utils/map');

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

// 获取设施分类列表
const getFacilityCategories = async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM facility_categories ORDER BY category_name'
    );

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('获取设施分类错误:', error);
    res.status(500).json({
      success: false,
      message: '获取设施分类失败'
    });
  }
};

// 获取设施列表 - 完整版
const getFacilities = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category_code, 
      keyword
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    console.log(`分页参数: page=${page}, limit=${limit}, offset=${offset}`);
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    // 按分类筛选
    if (category_code) {
      whereClause += ' AND category_code = ?';
      params.push(category_code);
    }

    // 按关键词筛选
    if (keyword) {
      whereClause += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }

    console.log(`查询条件: ${whereClause}, 参数:`, params);

    // 超级简化查询，使用字符串拼接避免参数绑定问题
    const sql = `
      SELECT 
        facility_id,
        name,
        category_code,
        location_id
      FROM facilities
      ${whereClause.replace(/\?/g, (match, offset) => {
        const paramIndex = (whereClause.slice(0, offset).match(/\?/g) || []).length;
        return typeof params[paramIndex] === 'string' ? `'${params[paramIndex]}'` : params[paramIndex];
      })}
      ORDER BY facility_id
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    console.log(`执行SQL: ${sql}`);
    console.log(`参数: [${[...params, parseInt(limit), offset].join(', ')}]`);
    const [facilities] = await pool.execute(sql, [...params, parseInt(limit), parseInt(offset)]);
    console.log(`查询到 ${facilities.length} 条记录`);

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM facilities
      ${whereClause.replace(/\?/g, (match, offset) => {
        const paramIndex = (whereClause.slice(0, offset).match(/\?/g) || []).length;
        return typeof params[paramIndex] === 'string' ? `'${params[paramIndex]}'` : params[paramIndex];
      })}
    `;
    
    const [countResult] = await pool.query(countSql);
    console.log(`总记录数: ${countResult[0].total}`);

    res.json({
      success: true,
      data: {
        facilities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('获取设施列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取设施列表失败'
    });
  }
};

// 创建设施
const createFacility = async (req, res) => {
  try {
    const {
      name,
      formatted_address,
      longitude,
      latitude,
      category_code,
      district_code
    } = req.body;

    // 如果没有提供区域代码，尝试从地址提取
    const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

    // 首先检查或创建位置记录
    let locationId;
    const [existingLocation] = await pool.execute(
      'SELECT location_id FROM locations WHERE longitude = ? AND latitude = ?',
      [longitude, latitude]
    );

    if (existingLocation.length > 0) {
      locationId = existingLocation[0].location_id;
    } else {
      // 创建新的位置记录
      const [locationResult] = await pool.execute(
        'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
        [formatted_address, longitude, latitude, finalDistrictCode]
      );
      locationId = locationResult.insertId;
    }

    // 创建设施记录
    const [result] = await pool.execute(`
      INSERT INTO facilities (name, location_id, category_code)
      VALUES (?, ?, ?)
    `, [name, locationId, category_code]);

    res.status(201).json({
      success: true,
      message: '设施创建成功',
      data: {
        facility_id: result.insertId
      }
    });

  } catch (error) {
    console.error('创建设施错误:', error);
    res.status(500).json({
      success: false,
      message: '设施创建失败，请稍后重试'
    });
  }
};

// 获取单个设施详情
const getFacilityById = async (req, res) => {
  try {
    const { id } = req.params;

    const [facilities] = await pool.execute(`
      SELECT 
        f.facility_id,
        f.name,
        l.formatted_address as address,
        f.category_code,
        f.last_updated,
        fc.category_name,
        fc.parent_code,
        l.longitude,
        l.latitude,
        l.district_code
      FROM facilities f
      JOIN facility_categories fc ON f.category_code = fc.category_code
      JOIN locations l ON f.location_id = l.location_id
      WHERE f.facility_id = ?
    `, [id]);

    if (facilities.length === 0) {
      return res.status(404).json({
        success: false,
        message: '设施不存在'
      });
    }

    res.json({
      success: true,
      data: facilities[0]
    });

  } catch (error) {
    console.error('获取设施详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取设施详情失败'
    });
  }
};

// 更新设施
const updateFacility = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      longitude,
      latitude,
      category_code
    } = req.body;

    // 检查设施是否存在
    const [existing] = await pool.execute(
      'SELECT facility_id FROM facilities WHERE facility_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '设施不存在'
      });
    }

    // 如果地址改变，更新位置表
    if (address && longitude && latitude) {
      const [existingLocation] = await pool.execute(
        'SELECT location_id FROM locations WHERE formatted_address = ?',
        [address]
      );

      if (existingLocation.length === 0) {
        await pool.execute(
          'INSERT INTO locations (formatted_address, longitude, latitude) VALUES (?, ?, ?)',
          [address, longitude, latitude]
        );
      } else {
        await pool.execute(
          'UPDATE locations SET longitude = ?, latitude = ? WHERE address = ?',
          [longitude, latitude, address]
        );
      }
    }

    // 更新设施信息
    await pool.execute(`
      UPDATE facilities SET 
        name = COALESCE(?, name),
        category_code = COALESCE(?, category_code),
        last_updated = CURRENT_TIMESTAMP
      WHERE facility_id = ?
    `, [name, category_code, id]);

    res.json({
      success: true,
      message: '设施更新成功'
    });

  } catch (error) {
    console.error('更新设施错误:', error);
    res.status(500).json({
      success: false,
      message: '设施更新失败'
    });
  }
};

// 删除设施
const deleteFacility = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查设施是否存在
    const [existing] = await pool.execute(
      'SELECT facility_id FROM facilities WHERE facility_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '设施不存在'
      });
    }

    // 删除设施
    await pool.execute(
      'DELETE FROM facilities WHERE facility_id = ?',
      [id]
    );

    res.json({
      success: true,
      message: '设施删除成功'
    });

  } catch (error) {
    console.error('删除设施错误:', error);
    res.status(500).json({
      success: false,
      message: '设施删除失败'
    });
  }
};

// 从高德地图搜索POI并批量导入
const importPOIData = async (req, res) => {
  try {
    const { keywords, city, category_code } = req.body;

    if (!keywords || !city || !category_code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 调用高德地图API搜索POI
    const pois = await searchPOI(keywords, city);

    if (!pois || pois.length === 0) {
      return res.json({
        success: true,
        message: '未找到相关设施',
        data: { imported: 0 }
      });
    }

    let importedCount = 0;

    for (const poi of pois) {
      try {
        const { name, address, location } = poi;
        const [longitude, latitude] = location.split(',').map(Number);

        // 检查设施是否已存在（按名称和位置）
        // 首先查找或创建位置记录
        let locationId;
        const [existingLocation] = await pool.execute(
          'SELECT location_id FROM locations WHERE formatted_address = ?',
          [address]
        );

        if (existingLocation.length === 0) {
          // 创建新位置记录
          const [locationResult] = await pool.execute(
            'INSERT INTO locations (formatted_address, longitude, latitude) VALUES (?, ?, ?)',
            [address, longitude, latitude]
          );
          locationId = locationResult.insertId;
        } else {
          locationId = existingLocation[0].location_id;
        }

        // 检查设施是否已存在
        const [existing] = await pool.execute(
          'SELECT facility_id FROM facilities WHERE name = ? AND location_id = ?',
          [name, locationId]
        );

        if (existing.length === 0) {
          // 创建设施记录
          await pool.execute(
            'INSERT INTO facilities (name, location_id, category_code) VALUES (?, ?, ?)',
            [name, locationId, category_code]
          );

          importedCount++;
        }
      } catch (error) {
        console.error('导入POI错误:', poi, error);
        // 继续处理下一个POI
      }
    }

    res.json({
      success: true,
      message: `成功导入 ${importedCount} 个设施`,
      data: {
        total: pois.length,
        imported: importedCount
      }
    });

  } catch (error) {
    console.error('导入POI数据错误:', error);
    res.status(500).json({
      success: false,
      message: 'POI数据导入失败'
    });
  }
};

// 获取设施统计
const getFacilityStats = async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        fc.category_name,
        fc.category_code,
        COUNT(f.facility_id) as count
      FROM facility_categories fc
      LEFT JOIN facilities f ON fc.category_code = f.category_code
      GROUP BY fc.category_code, fc.category_name
      ORDER BY count DESC
    `);

    const [totalCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM facilities'
    );

    res.json({
      success: true,
      data: {
        by_category: stats,
        total: totalCount[0].total
      }
    });

  } catch (error) {
    console.error('获取设施统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
};

// 地图搜索设施
const searchMapFacilities = async (req, res) => {
  try {
    const { 
      keywords, 
      city = '上海', 
      page = 1, 
      limit = 20 
    } = req.query;

    if (!keywords) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词'
      });
    }

    // 调用高德地图API搜索
    const searchResult = await searchPOIByText(keywords, city, parseInt(page), parseInt(limit));

    if (searchResult.success) {
      res.json({
        success: true,
        data: {
          facilities: searchResult.facilities,
          pagination: {
            page: searchResult.page,
            limit: searchResult.limit,
            total: searchResult.total,
            pages: Math.ceil(searchResult.total / searchResult.limit)
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: searchResult.message || '搜索失败'
      });
    }

  } catch (error) {
    console.error('地图搜索设施错误:', error);
    res.status(500).json({
      success: false,
      message: '地图搜索服务异常'
    });
  }
};

// 获取设施详细信息并检查评价统计
const getFacilitiesWithFeedback = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category_code, 
      keyword,
      longitude,
      latitude,
      radius
    } = req.query;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    // 按分类筛选
    if (category_code) {
      whereClause += ' AND f.category_code = ?';
      params.push(category_code);
    }

    // 按关键词筛选
    if (keyword) {
      whereClause += ' AND f.name LIKE ?';
      params.push(`%${keyword}%`);
    }

    // 按地理范围筛选
    if (longitude && latitude && radius) {
      whereClause += ` AND (
        6371 * acos(
          cos(radians(?)) * cos(radians(l.latitude)) * 
          cos(radians(l.longitude) - radians(?)) + 
          sin(radians(?)) * sin(radians(l.latitude))
        )
      ) <= ?`;
      params.push(latitude, longitude, latitude, radius / 1000);
    }

    const [facilities] = await pool.execute(`
      SELECT 
        f.facility_id,
        f.name,
        l.formatted_address as address,
        f.category_code,
        f.last_updated,
        fc.category_name,
        l.longitude,
        l.latitude,
        l.district_code,
        COALESCE(AVG(fb.score), 0) as average_score,
        COUNT(fb.feedback_id) as feedback_count
      FROM facilities f
      JOIN facility_categories fc ON f.category_code = fc.category_code
      JOIN locations l ON f.location_id = l.location_id
      LEFT JOIN facility_feedback ff ON f.facility_id = ff.facility_id
      LEFT JOIN feedback_base fb ON ff.feedback_id = fb.feedback_id
      ${whereClause}
      GROUP BY f.facility_id, f.name, l.formatted_address, f.category_code, 
               f.last_updated, fc.category_name, l.longitude, l.latitude, l.district_code
      ORDER BY feedback_count DESC, f.last_updated DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(DISTINCT f.facility_id) as total
      FROM facilities f
      JOIN locations l ON f.location_id = l.location_id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        facilities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取设施列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取设施列表失败'
    });
  }
};

module.exports = {
  getFacilityCategories,
  getFacilities,
  createFacility,
  getFacilityById,
  updateFacility,
  deleteFacility,
  importPOIData,
  getFacilityStats,
  searchMapFacilities,
  getFacilitiesWithFeedback
};
