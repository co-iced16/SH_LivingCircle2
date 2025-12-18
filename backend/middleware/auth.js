const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// JWT认证中间件
const authenticateToken = async (req, res, next) => {
  console.log('认证中间件开始，请求路径:', req.path);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Authorization Header:', authHeader);
  console.log('提取的Token:', token ? `${token.substring(0, 20)}...` : '无');

  if (!token) {
    console.log('认证失败：未提供token');
    return res.status(401).json({ 
      success: false, 
      message: '未提供访问令牌' 
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error('⚠️ 警告: JWT_SECRET未设置，使用默认密钥（仅用于开发环境）');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-change-in-production');
    console.log('JWT解码结果:', decoded); // 添加调试信息
    
    // 从数据库获取用户信息
    // 向后兼容：支持旧的userId字段名和新的user_id字段名
    const userId = decoded.user_id || decoded.userId;
    console.log('使用的用户ID:', userId);
    console.log('JWT解码字段:', {
      user_id: decoded.user_id,
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    });
    
    if (!userId) {
      console.log('认证失败：JWT中缺少用户ID字段');
      return res.status(401).json({ 
        success: false, 
        message: '无效的令牌格式' 
      });
    }
    
    const [users] = await pool.execute(
      'SELECT user_id, username, email, role FROM users WHERE user_id = ?',
      [userId]
    );

    console.log('数据库查询结果:', users); // 添加调试信息

    if (users.length === 0) {
      console.log('认证失败：用户不存在，user_id:', userId);
      return res.status(401).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    console.log('认证成功，用户信息:', users[0]);
    req.user = users[0];
    next();
  } catch (error) {
    console.log('JWT验证失败:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: '令牌已过期' 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      message: '无效的令牌' 
    });
  }
};

// 管理员权限中间件
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: '需要管理员权限' 
    });
  }
  next();
};

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // 验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '输入数据验证失败',
      details: err.details,
      error_code: 'VALIDATION_ERROR'
    });
  }

  // 数据库唯一约束错误
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: '数据已存在',
      error_code: 'DUPLICATE_ENTRY'
    });
  }

  // 数据库外键约束错误
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(400).json({
      success: false,
      message: '数据关联错误，请检查关联数据是否存在',
      error_code: 'FOREIGN_KEY_CONSTRAINT'
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: err.name === 'TokenExpiredError' ? '令牌已过期' : '无效的令牌',
      error_code: 'JWT_ERROR'
    });
  }

  // 数据库连接错误
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({
      success: false,
      message: '数据库连接失败，请稍后重试',
      error_code: 'DATABASE_CONNECTION_ERROR'
    });
  }

  // 默认错误 - 生产环境不暴露详细错误信息
  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    success: false,
    message: isDevelopment ? err.message : '服务器内部错误',
    error_code: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { stack: err.stack })
  });
};

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  errorHandler,
  requestLogger
};
