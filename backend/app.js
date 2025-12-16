const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { errorHandler, requestLogger } = require('./middleware/auth');

// 导入路由
const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const evaluationRoutes = require('./routes/evaluation');
const facilityRoutes = require('./routes/facilities');
const mapRoutes = require('./routes/map');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://restapi.amap.com"]
    }
  }
}));

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // 生产环境域名
    : ['http://localhost:8080', 'http://127.0.0.1:8080'], // 开发环境
  credentials: true
}));

// 请求限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  }
});
app.use(limiter);

// JSON解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use(requestLogger);

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/map', mapRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const startServer = async () => {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.log('💡 请确保MySQL服务已启动，并运行: npm run init-db');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log('🚀 服务器启动成功！');
      console.log(`📱 服务地址: http://localhost:${PORT}`);
      console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      console.log('');
      console.log('📋 可用的API端点:');
      console.log('   POST /api/auth/register     - 用户注册');
      console.log('   POST /api/auth/login        - 用户登录');
      console.log('   GET  /api/auth/profile      - 获取用户信息');
      console.log('   POST /api/feedback/community - 提交社区反馈');
      console.log('   POST /api/feedback/facility  - 提交设施反馈');
      console.log('   POST /api/evaluation/evaluate - 执行便利度评估');
      console.log('   GET  /api/facilities/search  - 搜索设施');
      console.log('   GET  /api/map/geocode       - 地理编码');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error.message);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🔄 正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 正在关闭服务器...');
  process.exit(0);
});

startServer();

module.exports = app;
