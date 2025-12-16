const mysql = require('mysql2/promise');
const path = require('path');

// 根据脚本运行路径智能加载环境变量
const envPath = process.cwd().includes('scripts') 
  ? path.join(__dirname, '..', '.env')
  : path.join(__dirname, '..', '.env');
  
require('dotenv').config({ path: envPath });

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 测试数据库连接
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  testConnection
};
