const { pool } = require('../config/database');

// 创建规划报告
const createReport = async (req, res) => {
  try {
    const { title, region_boundary, start_date, end_date } = req.body;

    // 验证管理员权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以创建规划报告'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO planning_reports (admin_id, title, region_boundary, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.user_id, title, JSON.stringify(region_boundary), start_date, end_date]);

    res.status(201).json({
      success: true,
      message: '规划报告创建成功',
      data: { report_id: result.insertId }
    });

  } catch (error) {
    console.error('创建规划报告错误:', error);
    res.status(500).json({
      success: false,
      message: '创建规划报告失败'
    });
  }
};

// 获取规划报告列表
const getReports = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10)); // 限制最大100
    const offset = (pageNum - 1) * limitNum;

    // MySQL不支持在LIMIT和OFFSET中使用参数占位符，需要直接拼接
    // 由于已经通过parseInt验证，这里是安全的
    const [reports] = await pool.execute(`
      SELECT 
        pr.report_id,
        pr.title,
        pr.region_boundary,
        pr.start_date,
        pr.end_date,
        pr.generated_at,
        u.username as admin_name
      FROM planning_reports pr
      JOIN users u ON pr.admin_id = u.user_id
      ORDER BY pr.generated_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM planning_reports'
    );

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('获取规划报告列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取报告列表失败'
    });
  }
};

// 获取报告详情（含短板分析）
const getReportDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [reports] = await pool.execute(`
      SELECT 
        pr.*,
        u.username as admin_name
      FROM planning_reports pr
      JOIN users u ON pr.admin_id = u.user_id
      WHERE pr.report_id = ?
    `, [id]);

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }

    const report = reports[0];

    // 格式化日期
    const formatDate = (dateValue) => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) {
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      const dateStr = String(dateValue).split('T')[0];
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    const startDate = formatDate(report.start_date);
    const endDate = formatDate(report.end_date);

    // 获取报告相关的评估任务位置信息
    const startDateTime = startDate ? `${startDate} 00:00:00` : null;
    const endDateTime = endDate ? `${endDate} 23:59:59` : null;
    
    const [taskLocations] = await pool.execute(`
      SELECT DISTINCT
        l.formatted_address,
        l.district_code,
        COUNT(DISTINCT et.task_id) as task_count,
        AVG(et.radius) as avg_radius
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.created_at BETWEEN ? AND ?
      GROUP BY l.formatted_address, l.district_code
      ORDER BY task_count DESC
      LIMIT 10
    `, startDateTime && endDateTime ? [startDateTime, endDateTime] : []);

    // 获取短板分析
    const [deficiencies] = await pool.execute(`
      SELECT 
        da.*,
        fc.category_name
      FROM deficiency_analyses da
      JOIN facility_categories fc ON da.category_code = fc.category_code
      WHERE da.report_id = ?
      ORDER BY da.problem_type, fc.category_name
    `, [id]);

    res.json({
      success: true,
      data: {
        report: reports[0],
        deficiencies,
        task_locations: taskLocations,
        location_summary: taskLocations.length > 0
          ? (taskLocations.length <= 3
              ? taskLocations.map(t => t.formatted_address).join('、')
              : `${taskLocations.slice(0, 3).map(t => t.formatted_address).join('、')}等${taskLocations.length}个区域`)
          : null
      }
    });

  } catch (error) {
    console.error('获取报告详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取报告详情失败'
    });
  }
};

// 生成短板分析
const generateDeficiencyAnalysis = async (req, res) => {
  try {
    const { report_id } = req.params;

    // 验证管理员权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以生成分析'
      });
    }

    // 获取报告信息
    const [reports] = await pool.execute(
      'SELECT * FROM planning_reports WHERE report_id = ?',
      [report_id]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }

    const report = reports[0];

    // 格式化日期，确保是 YYYY-MM-DD 格式
    // MySQL 返回的 DATE 类型可能是 Date 对象或字符串
    const formatDate = (dateValue) => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) {
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      // 如果是字符串，确保格式正确
      const dateStr = String(dateValue).split('T')[0]; // 处理 ISO 格式
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }
      // 尝试解析其他格式
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    const startDate = formatDate(report.start_date);
    const endDate = formatDate(report.end_date);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '报告日期格式无效，无法生成分析'
      });
    }

    // 首先统计评估任务数量，用于验证数据有效性
    // 注意：start_date 需要从00:00:00开始，end_date 需要到23:59:59结束
    const startDateTime = `${startDate} 00:00:00`;
    const endDateTime = `${endDate} 23:59:59`;

    console.log(`📊 生成分析 - 报告ID: ${report_id}, 日期范围: ${startDateTime} 至 ${endDateTime}`);
    
    // 获取评估任务统计和位置信息
    const [taskStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT et.task_id) as task_count,
        GROUP_CONCAT(DISTINCT l.formatted_address SEPARATOR '；') as locations,
        GROUP_CONCAT(DISTINCT l.district_code SEPARATOR ',') as district_codes
      FROM evaluation_tasks et
      JOIN locations l ON et.center_location_id = l.location_id
      WHERE et.created_at BETWEEN ? AND ?
    `, [startDateTime, endDateTime]);

    const taskCount = taskStats[0]?.task_count || 0;

    if (taskCount === 0) {
      console.log(`⚠️ 在 ${startDate} 至 ${endDate} 期间没有找到评估任务数据`);
      return res.status(400).json({
        success: false,
        message: `在${startDate}至${endDate}期间没有找到评估任务数据，无法生成分析。请确保该时间段内有评估任务记录。`
      });
    }

    console.log(`✅ 找到 ${taskCount} 个评估任务`);

    // 提取位置信息用于报告
    const locations = taskStats[0]?.locations ? taskStats[0].locations.split('；').filter((loc, idx, arr) => arr.indexOf(loc) === idx).slice(0, 5) : [];
    const locationSummary = locations.length > 0 
      ? (locations.length <= 3 
          ? locations.join('、') 
          : `${locations.slice(0, 3).join('、')}等${locations.length}个区域`)
      : '多个评估区域';

    // 分析低分设施类别（基于评估结果）
    // 统计每个类别在不同评估任务中的情况，并获取相关位置信息
    const [lowScoreCategories] = await pool.execute(`
      SELECT 
        erd.category_code,
        fc.category_name,
        COUNT(DISTINCT erd.facility_id) as facility_count,
        COUNT(DISTINCT erd.task_id) as task_count,
        AVG(erd.distance) as avg_distance,
        MIN(erd.distance) as min_distance,
        MAX(erd.distance) as max_distance,
        AVG(COALESCE(fb.score, 3)) as avg_feedback_score,
        COUNT(DISTINCT CASE WHEN fb.score IS NOT NULL THEN ff.feedback_id END) as feedback_count,
        GROUP_CONCAT(DISTINCT CONCAT(l.formatted_address, '(', et.radius, '米范围)') SEPARATOR '；') as task_locations
      FROM evaluation_result_details erd
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      JOIN evaluation_tasks et ON erd.task_id = et.task_id
      JOIN locations l ON et.center_location_id = l.location_id
      LEFT JOIN facility_feedback ff ON erd.facility_id = ff.facility_id
      LEFT JOIN feedback_base fb ON ff.feedback_id = fb.feedback_id
      WHERE et.created_at BETWEEN ? AND ?
      GROUP BY erd.category_code, fc.category_name
      HAVING facility_count < 5 OR avg_distance > 1000 OR avg_feedback_score < 3
      ORDER BY facility_count ASC, avg_distance DESC
    `, [startDateTime, endDateTime]);

    // 清除旧的分析结果
    await pool.execute(
      'DELETE FROM deficiency_analyses WHERE report_id = ?',
      [report_id]
    );

    // 插入新的短板分析，使用更明确的描述
    for (const category of lowScoreCategories) {
      let problem_type = 'missing';
      let suggestion = '';

      // 处理位置信息
      const taskLocations = category.task_locations 
        ? category.task_locations.split('；').filter((loc, idx, arr) => arr.indexOf(loc) === idx)
        : [];
      const locationInfo = taskLocations.length > 0
        ? (taskLocations.length <= 2
            ? `主要涉及区域：${taskLocations.join('、')}`
            : `主要涉及区域：${taskLocations.slice(0, 2).join('、')}等${taskLocations.length}个评估区域`)
        : `涉及${locationSummary}`;

      // 确定主要问题类型（优先级：数量不足 > 距离远 > 评分低）
      if (category.facility_count < 5) {
        problem_type = 'missing';
        suggestion = `【分析时段】${startDate} 至 ${endDate}\n【数据来源】基于${category.task_count}个评估任务的数据分析\n【${locationInfo}】\n【问题发现】${category.category_name}类设施数量不足，在评估范围内仅发现${category.facility_count}个该类设施\n【改进建议】建议在${locationSummary}增设${category.category_name}类设施，以满足居民日常需求。可优先考虑在人口密度较高、交通便利的区域布局。`;
      } else if (category.avg_distance > 1000) {
        problem_type = 'remote';
        const distanceKm = (category.avg_distance / 1000).toFixed(1);
        suggestion = `【分析时段】${startDate} 至 ${endDate}\n【数据来源】基于${category.task_count}个评估任务的数据分析\n【${locationInfo}】\n【问题发现】${category.category_name}类设施距离评估中心点较远。平均距离为${Math.round(category.avg_distance)}米（约${distanceKm}公里），最近距离${Math.round(category.min_distance)}米，最远距离${Math.round(category.max_distance)}米\n【改进建议】建议在${locationSummary}优化${category.category_name}类设施的布局，缩短居民到达距离。可考虑在现有设施密度较低的区域增设新设施，或调整现有设施的分布位置。`;
      } else if (category.avg_feedback_score < 3) {
        problem_type = 'low_score';
        const feedbackInfo = category.feedback_count > 0 
          ? `基于${category.feedback_count}条用户反馈` 
          : '基于有限的用户反馈';
        suggestion = `【分析时段】${startDate} 至 ${endDate}\n【数据来源】${feedbackInfo}，基于${category.task_count}个评估任务的数据分析\n【${locationInfo}】\n【问题发现】${category.category_name}类设施的居民满意度较低，平均评分仅${category.avg_feedback_score.toFixed(1)}分（满分5分）\n【改进建议】建议在${locationSummary}提升${category.category_name}类设施的服务质量和管理水平，改善居民体验。可重点关注设施环境、服务态度、营业时间等方面，收集居民反馈并持续改进。`;
      }

      await pool.execute(`
        INSERT INTO deficiency_analyses (report_id, category_code, problem_type, suggestion)
        VALUES (?, ?, ?, ?)
      `, [report_id, category.category_code, problem_type, suggestion]);
    }

    res.json({
      success: true,
      message: `成功生成${lowScoreCategories.length}条短板分析`,
      data: { 
        analysis_count: lowScoreCategories.length,
        task_count: taskCount,
        date_range: `${startDate} 至 ${endDate}`
      }
    });

  } catch (error) {
    console.error('生成短板分析错误:', error);
    res.status(500).json({
      success: false,
      message: '生成分析失败'
    });
  }
};

// 删除报告
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以删除报告'
      });
    }

    await pool.execute('DELETE FROM planning_reports WHERE report_id = ?', [id]);

    res.json({
      success: true,
      message: '报告删除成功'
    });

  } catch (error) {
    console.error('删除报告错误:', error);
    res.status(500).json({
      success: false,
      message: '删除报告失败'
    });
  }
};

// 获取评估任务的日期范围（辅助功能，帮助用户了解可用数据）
const getEvaluationTaskDateRange = async (req, res) => {
  try {
    const [dateRange] = await pool.execute(`
      SELECT 
        MIN(DATE(created_at)) as min_date,
        MAX(DATE(created_at)) as max_date,
        COUNT(*) as total_tasks
      FROM evaluation_tasks
    `);

    const [monthlyStats] = await pool.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as task_count
      FROM evaluation_tasks
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);

    res.json({
      success: true,
      data: {
        date_range: dateRange[0] || null,
        monthly_stats: monthlyStats
      }
    });

  } catch (error) {
    console.error('获取评估任务日期范围错误:', error);
    res.status(500).json({
      success: false,
      message: '获取日期范围失败'
    });
  }
};

module.exports = {
  createReport,
  getReports,
  getReportDetails,
  generateDeficiencyAnalysis,
  deleteReport,
  getEvaluationTaskDateRange
};

