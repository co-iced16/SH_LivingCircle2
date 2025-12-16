/**
 * 修复数据库表结构脚本
 * 解决经度字段精度不足的问题
 * 
 * 问题：longitude DECIMAL(10,8) 只支持2位整数，但上海经度121.xxx需要3位整数
 * 解决：修改为 longitude DECIMAL(11,8) 支持3位整数
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabaseSchema() {
  let connection;
  
  try {
    // 连接到数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('连接到数据库成功');

    // 检查当前表结构
    const [tableInfo] = await connection.execute(`
      DESCRIBE locations
    `);
    
    console.log('当前 locations 表结构:');
    console.table(tableInfo);

    // 修改 longitude 字段精度
    await connection.execute(`
      ALTER TABLE locations 
      MODIFY COLUMN longitude DECIMAL(11, 8) NOT NULL
    `);
    
    console.log('✅ longitude 字段已修改为 DECIMAL(11, 8)');

    // 检查修改后的表结构
    const [newTableInfo] = await connection.execute(`
      DESCRIBE locations
    `);
    
    console.log('修改后 locations 表结构:');
    console.table(newTableInfo);

    console.log('🎉 数据库表结构修复完成！');

  } catch (error) {
    console.error('❌ 数据库表结构修复失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此文件，则执行修复
if (require.main === module) {
  fixDatabaseSchema();
}

module.exports = fixDatabaseSchema;
