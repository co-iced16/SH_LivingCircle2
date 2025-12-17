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
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const [reports] = await pool.query(`
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

    // 获取短板分析
    const [deficiencies] = await pool.execute(`
      SELECT 
        da.*,
        fc.category_name
      FROM deficiency_analyses da
      JOIN facility_categories fc ON da.category_code = fc.category_code
      WHERE da.report_id = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        report: reports[0],
        deficiencies
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

    // 分析低分设施类别（基于评估结果）
    const [lowScoreCategories] = await pool.execute(`
      SELECT 
        erd.category_code,
        fc.category_name,
        COUNT(DISTINCT erd.facility_id) as facility_count,
        AVG(erd.distance) as avg_distance,
        AVG(COALESCE(fb.score, 3)) as avg_feedback_score
      FROM evaluation_result_details erd
      JOIN facility_categories fc ON erd.category_code = fc.category_code
      JOIN evaluation_tasks et ON erd.task_id = et.task_id
      LEFT JOIN facility_feedback ff ON erd.facility_id = ff.facility_id
      LEFT JOIN feedback_base fb ON ff.feedback_id = fb.feedback_id
      WHERE et.created_at BETWEEN ? AND ?
      GROUP BY erd.category_code, fc.category_name
      HAVING facility_count < 5 OR avg_distance > 1000 OR avg_feedback_score < 3
      ORDER BY facility_count ASC, avg_distance DESC
    `, [report.start_date, report.end_date]);

    // 清除旧的分析结果
    await pool.execute(
      'DELETE FROM deficiency_analyses WHERE report_id = ?',
      [report_id]
    );

    // 插入新的短板分析
    for (const category of lowScoreCategories) {
      let problem_type = 'missing';
      let suggestion = '';

      if (category.facility_count < 5) {
        problem_type = 'missing';
        suggestion = `建议在该区域增设${category.category_name}类设施，当前仅有${category.facility_count}个`;
      } else if (category.avg_distance > 1000) {
        problem_type = 'remote';
        suggestion = `${category.category_name}平均距离${Math.round(category.avg_distance)}米，建议优化布局`;
      } else if (category.avg_feedback_score < 3) {
        problem_type = 'low_score';
        suggestion = `${category.category_name}居民满意度仅${category.avg_feedback_score.toFixed(1)}分，建议提升服务质量`;
      }

      await pool.execute(`
        INSERT INTO deficiency_analyses (report_id, category_code, problem_type, suggestion)
        VALUES (?, ?, ?, ?)
      `, [report_id, category.category_code, problem_type, suggestion]);
    }

    res.json({
      success: true,
      message: `成功生成${lowScoreCategories.length}条短板分析`,
      data: { analysis_count: lowScoreCategories.length }
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

module.exports = {
  createReport,
  getReports,
  getReportDetails,
  generateDeficiencyAnalysis,
  deleteReport
};

