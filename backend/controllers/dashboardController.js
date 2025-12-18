const { pool } = require('../config/database');

// 获取首页统计数据
const getDashboardStats = async (req, res) => {
  try {
    // 并行查询所有统计数据
    const [
      facilitiesResult,
      feedbacksResult,
      evaluationsResult,
      usersResult
    ] = await Promise.all([
      // 设施数量
      pool.execute('SELECT COUNT(*) as count FROM facilities'),
      // 反馈数量（包括社区反馈和设施反馈）
      pool.execute('SELECT COUNT(*) as count FROM feedback_base'),
      // 评估次数
      pool.execute('SELECT COUNT(*) as count FROM evaluation_tasks'),
      // 用户数量（包括所有用户，不排除管理员）
      pool.execute('SELECT COUNT(*) as count FROM users')
    ]);

    // 提取统计数据
    const facilitiesCount = facilitiesResult[0][0]?.count || 0;
    const feedbacksCount = feedbacksResult[0][0]?.count || 0;
    const evaluationsCount = evaluationsResult[0][0]?.count || 0;
    const usersCount = usersResult[0][0]?.count || 0;

    // 确保返回正确的数据格式（转换为数字）
    const result = {
      facilitiesCount: Number(facilitiesCount),
      feedbacksCount: Number(feedbacksCount),
      evaluationsCount: Number(evaluationsCount),
      usersCount: Number(usersCount)
    };

    console.log('📊 首页统计数据:', result);
    console.log('📊 原始查询结果:', {
      facilities: facilitiesResult[0][0],
      feedbacks: feedbacksResult[0][0],
      evaluations: evaluationsResult[0][0],
      users: usersResult[0][0]
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取首页统计数据错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
};

// 获取最近活动
const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 获取最近的用户注册（users表没有created_at字段，使用user_id作为排序依据）
    // 注意：这不是准确的注册时间，但可以显示最近创建的用户
    const userLimit = Math.max(1, Math.ceil(limit / 3));
    const [recentUsers] = await pool.execute(`
      SELECT 
        'user_register' as activity_type,
        CONCAT('新用户注册') as title,
        CONCAT('用户 "', username, '" 注册了账户') as description,
        NOW() as timestamp,
        '#52c41a' as color
      FROM users
      WHERE role != 'admin'
      ORDER BY user_id DESC
      LIMIT ${userLimit}
    `);

    // 获取最近的社区反馈
    const feedbackLimit = Math.max(1, Math.ceil(limit / 3));
    const [recentCommunityFeedback] = await pool.execute(`
      SELECT 
        'community_feedback' as activity_type,
        CONCAT('社区评价提交') as title,
        CONCAT('用户对 "', COALESCE(l.formatted_address, '某位置'), '" 提交了评价') as description,
        fb.submitted_at as timestamp,
        '#1890ff' as color
      FROM feedback_base fb
      LEFT JOIN community_feedback cf ON fb.feedback_id = cf.feedback_id
      LEFT JOIN locations l ON cf.location_id = l.location_id
      WHERE fb.feedback_type = 'community'
      ORDER BY fb.submitted_at DESC
      LIMIT ${feedbackLimit}
    `);

    // 获取最近的评估任务
    const evaluationLimit = Math.max(1, Math.ceil(limit / 3));
    const [recentEvaluations] = await pool.execute(`
      SELECT 
        'evaluation' as activity_type,
        CONCAT('便利度评估完成') as title,
        CONCAT('完成了 "', COALESCE(l.formatted_address, '某位置'), '" 的便利度评估') as description,
        et.created_at as timestamp,
        '#fa8c16' as color
      FROM evaluation_tasks et
      LEFT JOIN locations l ON et.center_location_id = l.location_id
      ORDER BY et.created_at DESC
      LIMIT ${evaluationLimit}
    `);

    // 格式化时间戳为字符串
    const formatTimestamp = (timestamp) => {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${minute}`;
    };

    // 合并所有活动并按时间排序（先排序再格式化）
    // 注意：recentUsers使用NOW()，所以需要特殊处理
    const allActivities = [
      ...recentUsers.map((u, index) => ({
        ...u,
        originalTimestamp: new Date(Date.now() - index * 60000) // 为每个用户注册分配不同的时间
      })),
      ...recentCommunityFeedback.map(f => ({
        ...f,
        originalTimestamp: f.timestamp
      })),
      ...recentEvaluations.map(e => ({
        ...e,
        originalTimestamp: e.timestamp
      }))
    ]
    .sort((a, b) => new Date(b.originalTimestamp) - new Date(a.originalTimestamp))
    .slice(0, limit)
    .map((activity, index) => ({
      id: index + 1,
      ...activity,
      timestamp: formatTimestamp(activity.originalTimestamp)
    }))
    .map(({ originalTimestamp, ...rest }) => rest); // 移除原始时间戳

    res.json({
      success: true,
      data: allActivities
    });

  } catch (error) {
    console.error('获取最近活动错误:', error);
    res.status(500).json({
      success: false,
      message: '获取最近活动失败'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivities
};
