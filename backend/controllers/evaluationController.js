const { pool } = require('../config/database');
const { calculateDistance, searchNearbyPOI } = require('../utils/map');

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

// 创建评估任务
const createEvaluationTask = async (req, res) => {
  try {
    const {
      formatted_address,
      longitude,
      latitude,
      radius,
      target_categories,
      transport_modes,
      district_code
    } = req.body;

    // 如果没有提供区域代码，尝试从地址提取
    const finalDistrictCode = district_code || extractDistrictCode(formatted_address);

    // 验证输入
    if (!formatted_address || !longitude || !latitude || !radius) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的位置信息'
      });
    }

    if (!target_categories || target_categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少选择一个设施类别'
      });
    }

    if (!transport_modes || transport_modes.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少选择一种交通方式'
      });
    }

    // 检查或创建位置记录
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

    // 创建评估任务
    const [taskResult] = await pool.execute(`
      INSERT INTO evaluation_tasks (user_id, center_location_id, radius)
      VALUES (?, ?, ?)
    `, [req.user.user_id, locationId, radius]);

    const task_id = taskResult.insertId;

    // 插入关注的设施类别
    for (const category_code of target_categories) {
      await pool.execute(`
        INSERT INTO evaluation_target_categories (task_id, category_code)
        VALUES (?, ?)
      `, [task_id, category_code]);
    }

    // 插入关注的交通方式
    for (const transport_mode of transport_modes) {
      await pool.execute(`
        INSERT INTO evaluation_target_modes (task_id, transport_mode)
        VALUES (?, ?)
      `, [task_id, transport_mode]);
    }

    // 执行评估计算（异步执行，不阻塞响应）
    performEvaluation(task_id, locationId, longitude, latitude, radius, target_categories, transport_modes)
      .catch(error => console.error('评估计算错误:', error));

    res.status(201).json({
      success: true,
      message: '评估任务创建成功，正在计算中...',
      data: { task_id }
    });

  } catch (error) {
    console.error('创建评估任务错误:', error);
    res.status(500).json({
      success: false,
      message: '创建评估任务失败'
    });
  }
};

// 执行评估计算（后台处理）
async function performEvaluation(task_id, center_location_id, longitude, latitude, radius, target_categories, transport_modes) {
  try {
    console.log(`开始执行评估计算 - 任务ID: ${task_id}`);
    
    let total_score = 0;
    let category_count = 0;
    let total_facilities = 0;

    // 对每个关注的设施类别进行评估
    for (const category_code of target_categories) {
      console.log(`评估设施类别: ${category_code}`);
      
      // 查找范围内的设施 - 简化距离计算
      const [facilities] = await pool.execute(`
        SELECT 
          f.facility_id,
          f.name,
          l.formatted_address,
          l.longitude,
          l.latitude,
          (111.32 * sqrt(
            pow(? - l.latitude, 2) + 
            pow((? - l.longitude) * cos(radians(?)), 2)
          )) * 1000 as distance
        FROM facilities f
        JOIN locations l ON f.location_id = l.location_id
        WHERE f.category_code = ? 
        HAVING distance <= ?
        ORDER BY distance
        LIMIT 50
      `, [latitude, longitude, latitude, category_code, radius]);

      console.log(`类别 ${category_code} 找到 ${facilities.length} 个设施`);
      total_facilities += facilities.length;

      // 对每个设施计算可达性得分
      for (const facility of facilities) {
        for (const transport_mode of transport_modes) {
          try {
            const distance = Math.round(facility.distance);

            // 估算时间（简化计算）
            let travel_time;
            switch (transport_mode) {
              case 'walk':
                travel_time = Math.round(distance / 80); // 步行速度约80m/min
                break;
              case 'bus':
                travel_time = Math.round(distance / 250); // 公交平均速度约250m/min
                break;
              case 'car':
                travel_time = Math.round(distance / 400); // 汽车平均速度约400m/min
                break;
              case 'ride':
                travel_time = Math.round(distance / 300); // 骑行平均速度约300m/min
                break;
              default:
                travel_time = Math.round(distance / 80);
            }

            // 记录评估结果详情
            await pool.execute(`
              INSERT INTO evaluation_result_details 
              (task_id, facility_id, category_code, transport_mode, travel_time, distance)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [task_id, facility.facility_id, category_code, transport_mode, travel_time, distance]);

          } catch (error) {
            console.error('计算设施可达性错误:', error);
          }
        }
      }

      // 计算该类别的得分（基于设施数量和平均距离）
      if (facilities.length > 0) {
        // 简化的评分算法：设施数量越多，距离越近得分越高
        const density_score = Math.min(facilities.length * 8, 40); // 密度得分（最高40分）
        const avg_distance = facilities.reduce((sum, f) => sum + f.distance, 0) / facilities.length;
        const distance_score = Math.max(60 - (avg_distance / 20), 10); // 距离得分（最高60分）
        
        const category_score = density_score + distance_score;
        total_score += category_score;
        console.log(`类别 ${category_code} 得分: ${category_score} (密度: ${density_score}, 距离: ${distance_score})`);
      } else {
        console.log(`类别 ${category_code} 没有找到设施`);
      }

      category_count++;
    }

    // 计算最终得分
    const final_score = category_count > 0 ? Math.min(total_score / category_count, 100) : 0;

    // 更新任务的总得分
    await pool.execute(`
      UPDATE evaluation_tasks SET total_score = ? WHERE task_id = ?
    `, [final_score, task_id]);

    console.log(`评估任务 ${task_id} 计算完成，总得分: ${final_score.toFixed(2)}, 设施总数: ${total_facilities}`);

  } catch (error) {
    console.error(`评估任务 ${task_id} 计算失败:`, error);
  }
}

// 获取用户的评估任务列表
const getEvaluationTasks = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [tasks] = await pool.execute(`
      SELECT 
        et.task_id,
        l.formatted_address as center_address,
        et.radius,
        et.created_at,
        et.total_score,
        l.longitude,
        l.latitude,
        l.district_code
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.user_id = ?
      ORDER BY et.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.user_id, parseInt(limit), offset]);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM evaluation_tasks WHERE user_id = ?
    `, [req.user.user_id]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取评估任务列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取评估任务列表失败'
    });
  }
};

// 获取评估结果（专门的结果接口）
const getEvaluationResult = async (req, res) => {
  try {
    const { id } = req.params;

    // 获取任务基本信息
    const [tasks] = await pool.execute(`
      SELECT 
        et.task_id,
        et.user_id,
        l.formatted_address as center_address,
        et.radius,
        et.created_at,
        et.total_score,
        l.longitude,
        l.latitude,
        l.district_code
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.task_id = ? AND et.user_id = ?
    `, [id, req.user.user_id]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '评估任务不存在'
      });
    }

    const task = tasks[0];

    // 获取关注的设施类别
    const [categories] = await pool.execute(`
      SELECT 
        etc.category_code,
        fc.category_name
      FROM evaluation_target_categories etc
      JOIN facility_categories fc ON etc.category_code = fc.category_code
      WHERE etc.task_id = ?
    `, [id]);

    // 获取关注的交通方式
    const [modes] = await pool.execute(`
      SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?
    `, [id]);

    // 获取评估结果详情
    const [details] = await pool.execute(`
      SELECT 
        erd.facility_id,
        erd.category_code,
        erd.transport_mode,
        erd.travel_time,
        erd.distance,
        f.name as facility_name,
        l.formatted_address as facility_address,
        l.longitude as facility_lng,
        l.latitude as facility_lat,
        fc.category_name
      FROM evaluation_result_details erd
      JOIN facilities f ON erd.facility_id = f.facility_id
      JOIN locations l ON f.location_id = l.location_id
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      WHERE erd.task_id = ?
      ORDER BY erd.category_code, erd.distance
    `, [id]);

    // 按类别统计
    const categoryStats = [];
    const categoryMap = new Map();

    for (const detail of details) {
      const key = detail.category_code;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category_code: key,
          category_name: detail.category_name,
          facilities: new Set(),
          total_distance: 0,
          min_distance: Infinity,
          avg_travel_time: 0,
          transport_modes: new Set()
        });
      }
      
      const cat = categoryMap.get(key);
      cat.facilities.add(detail.facility_id);
      cat.total_distance += detail.distance;
      cat.min_distance = Math.min(cat.min_distance, detail.distance);
      cat.transport_modes.add(detail.transport_mode);
    }

    for (const [key, cat] of categoryMap) {
      const facilityCount = cat.facilities.size;
      categoryStats.push({
        category_code: key,
        category_name: cat.category_name,
        facility_count: facilityCount,
        avg_distance: facilityCount > 0 ? Math.round(cat.total_distance / facilityCount) : 0,
        min_distance: cat.min_distance === Infinity ? 0 : Math.round(cat.min_distance),
        transport_modes: Array.from(cat.transport_modes)
      });
    }

    // 按交通方式统计
    const transportStats = [];
    const transportMap = new Map();

    for (const detail of details) {
      const key = detail.transport_mode;
      if (!transportMap.has(key)) {
        transportMap.set(key, {
          transport_mode: key,
          facility_count: 0,
          total_time: 0,
          avg_time: 0,
          total_distance: 0,
          avg_distance: 0
        });
      }
      
      const trans = transportMap.get(key);
      trans.facility_count++;
      trans.total_time += detail.travel_time;
      trans.total_distance += detail.distance;
    }

    for (const [key, trans] of transportMap) {
      trans.avg_time = trans.facility_count > 0 ? Math.round(trans.total_time / trans.facility_count) : 0;
      trans.avg_distance = trans.facility_count > 0 ? Math.round(trans.total_distance / trans.facility_count) : 0;
      transportStats.push(trans);
    }

    // 组装完整的评估结果
    const result = {
      task_info: {
        task_id: task.task_id,
        center_address: task.center_address,
        longitude: task.longitude,
        latitude: task.latitude,
        radius: task.radius,
        created_at: task.created_at,
        total_score: Math.round(parseFloat(task.total_score || 0))
      },
      target_categories: categories,
      transport_modes: modes.map(m => m.transport_mode),
      category_stats: categoryStats,
      transport_stats: transportStats,
      facility_details: details,
      summary: {
        total_facilities: new Set(details.map(d => d.facility_id)).size,
        total_categories: categories.length,
        total_transport_modes: modes.length,
        avg_distance: details.length > 0 ? Math.round(details.reduce((sum, d) => sum + d.distance, 0) / details.length) : 0
      }
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取评估结果错误:', error);
    res.status(500).json({
      success: false,
      message: '获取评估结果失败'
    });
  }
};

// 获取评估任务详情
const getEvaluationTaskDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // 获取任务基本信息
    const [tasks] = await pool.execute(`
      SELECT 
        et.task_id,
        et.user_id,
        l.formatted_address as center_address,
        et.radius,
        et.created_at,
        et.total_score,
        l.longitude,
        l.latitude,
        l.district_code
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.task_id = ? AND et.user_id = ?
    `, [id, req.user.user_id]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '评估任务不存在'
      });
    }

    const task = tasks[0];

    // 获取关注的设施类别
    const [categories] = await pool.execute(`
      SELECT 
        etc.category_code,
        fc.category_name
      FROM evaluation_target_categories etc
      JOIN facility_categories fc ON etc.category_code = fc.category_code
      WHERE etc.task_id = ?
    `, [id]);

    // 获取关注的交通方式
    const [modes] = await pool.execute(`
      SELECT transport_mode FROM evaluation_target_modes WHERE task_id = ?
    `, [id]);

    // 获取评估结果详情
    const [details] = await pool.execute(`
      SELECT 
        erd.facility_id,
        erd.category_code,
        erd.transport_mode,
        erd.travel_time,
        erd.distance,
        f.name as facility_name,
        l.formatted_address as facility_address,
        fc.category_name
      FROM evaluation_result_details erd
      JOIN facilities f ON erd.facility_id = f.facility_id
      JOIN locations l ON f.location_id = l.location_id
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      WHERE erd.task_id = ?
      ORDER BY erd.category_code, erd.distance
    `, [id]);

    res.json({
      success: true,
      data: {
        task,
        target_categories: categories,
        transport_modes: modes.map(m => m.transport_mode),
        evaluation_details: details
      }
    });

  } catch (error) {
    console.error('获取评估任务详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取评估任务详情失败'
    });
  }
};

// 删除评估任务
const deleteEvaluationTask = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查任务是否存在且属于当前用户
    const [tasks] = await pool.execute(`
      SELECT task_id FROM evaluation_tasks WHERE task_id = ? AND user_id = ?
    `, [id, req.user.user_id]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '评估任务不存在'
      });
    }

    // 删除评估任务（级联删除会自动删除相关记录）
    await pool.execute(`
      DELETE FROM evaluation_tasks WHERE task_id = ?
    `, [id]);

    res.json({
      success: true,
      message: '评估任务删除成功'
    });

  } catch (error) {
    console.error('删除评估任务错误:', error);
    res.status(500).json({
      success: false,
      message: '删除评估任务失败'
    });
  }
};

// 获取评估统计
const getEvaluationStats = async (req, res) => {
  try {
    // 用户的评估任务统计
    const [userStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tasks,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score
      FROM evaluation_tasks 
      WHERE user_id = ? AND total_score IS NOT NULL
    `, [req.user.user_id]);

    // 按设施类别统计
    const [categoryStats] = await pool.execute(`
      SELECT 
        fc.category_name,
        COUNT(DISTINCT erd.task_id) as task_count,
        COUNT(erd.facility_id) as facility_count,
        AVG(erd.distance) as avg_distance
      FROM evaluation_result_details erd
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      JOIN evaluation_tasks et ON erd.task_id = et.task_id
      WHERE et.user_id = ?
      GROUP BY erd.category_code, fc.category_name
      ORDER BY task_count DESC
    `, [req.user.user_id]);

    res.json({
      success: true,
      data: {
        user_stats: userStats[0],
        category_stats: categoryStats
      }
    });

  } catch (error) {
    console.error('获取评估统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
};

module.exports = {
  createEvaluationTask,
  getEvaluationTasks,
  getEvaluationTaskDetails,
  getEvaluationResult,
  deleteEvaluationTask,
  getEvaluationStats
};
