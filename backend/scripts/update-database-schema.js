/**
 * 修正数据库表结构脚本
 * 根据CLAUDE.md最新设计修正LOCATION表结构
 * 
 * 变更内容：
 * 1. 删除facilities表和locations表的现有数据
 * 2. 修正locations表结构：
 *    - 添加location_id作为主键
 *    - address改为formatted_address
 *    - 经纬度精度改为DECIMAL(10,6)
 *    - 添加district_code字段
 * 3. 修正facilities表结构：
 *    - 添加location_id外键，替代address外键
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateDatabaseSchema() {
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

    // 步骤1：删除现有数据（按外键依赖顺序）
    console.log('🗑️  开始删除现有数据...');
    
    // 删除evaluation_result_details表数据（如果存在）
    await connection.execute('DELETE FROM evaluation_result_details');
    console.log('已清空evaluation_result_details表');

    // 删除facility_feedback表数据
    await connection.execute('DELETE FROM facility_feedback');
    console.log('已清空facility_feedback表');

    // 删除community_feedback表数据
    await connection.execute('DELETE FROM community_feedback');
    console.log('已清空community_feedback表');

    // 删除feedback_base表数据
    await connection.execute('DELETE FROM feedback_base');
    console.log('已清空feedback_base表');

    // 删除evaluation_tasks表数据
    await connection.execute('DELETE FROM evaluation_tasks');
    console.log('已清空evaluation_tasks表');

    // 删除facilities表数据
    await connection.execute('DELETE FROM facilities');
    console.log('已清空facilities表');

    // 删除locations表数据
    await connection.execute('DELETE FROM locations');
    console.log('已清空locations表');

    // 步骤2：删除所有外键约束
    console.log('🔧 删除所有外键约束...');
    
    try {
      // 删除facilities表的外键约束
      await connection.execute('ALTER TABLE facilities DROP FOREIGN KEY facilities_ibfk_1');
      console.log('已删除facilities表的category外键约束');
    } catch (error) {
      console.log('facilities category外键约束可能已不存在');
    }

    try {
      await connection.execute('ALTER TABLE facilities DROP FOREIGN KEY facilities_ibfk_2');
      console.log('已删除facilities表的address外键约束');
    } catch (error) {
      console.log('facilities address外键约束可能已不存在');
    }

    try {
      // 删除community_feedback表的外键约束
      await connection.execute('ALTER TABLE community_feedback DROP FOREIGN KEY community_feedback_ibfk_2');
      console.log('已删除community_feedback表的address外键约束');
    } catch (error) {
      console.log('community_feedback address外键约束可能已不存在');
    }

    try {
      // 删除evaluation_tasks表的外键约束
      await connection.execute('ALTER TABLE evaluation_tasks DROP FOREIGN KEY evaluation_tasks_ibfk_2');
      console.log('已删除evaluation_tasks表的address外键约束');
    } catch (error) {
      console.log('evaluation_tasks address外键约束可能已不存在');
    }

    // 步骤3：禁用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    console.log('已禁用外键检查');

    // 步骤4：删除并重建locations表
    console.log('🔧 开始重建locations表结构...');
    
    await connection.execute('DROP TABLE IF EXISTS locations');
    console.log('已删除旧的locations表');

    // 创建新的locations表结构
    await connection.execute(`
      CREATE TABLE locations (
        location_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        formatted_address VARCHAR(255) NOT NULL,
        longitude DECIMAL(10, 6) NOT NULL,
        latitude DECIMAL(10, 6) NOT NULL,
        district_code VARCHAR(20),
        INDEX idx_coordinates (longitude, latitude),
        INDEX idx_address (formatted_address),
        INDEX idx_district (district_code)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ 新locations表创建成功');

    // 步骤5：修正facilities表结构
    console.log('🔧 开始修正facilities表结构...');
    
    // 删除旧的外键约束
    try {
      await connection.execute('ALTER TABLE facilities DROP FOREIGN KEY facilities_ibfk_2');
      console.log('已删除facilities表的address外键约束');
    } catch (error) {
      console.log('外键约束可能已不存在，继续执行...');
    }

    // 删除address字段，添加location_id字段
    try {
      await connection.execute('ALTER TABLE facilities DROP COLUMN address');
      console.log('已删除address字段');
    } catch (error) {
      console.log('address字段可能已不存在，继续执行...');
    }

    try {
      await connection.execute('ALTER TABLE facilities ADD COLUMN location_id BIGINT NOT NULL AFTER name');
      console.log('已添加location_id字段');
    } catch (error) {
      console.log('location_id字段可能已存在，继续执行...');
    }

    // 添加新的外键约束
    await connection.execute(`
      ALTER TABLE facilities 
      ADD CONSTRAINT fk_facilities_location 
      FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT
    `);
    console.log('已添加location_id外键约束');

    // 步骤6：修正其他表的外键约束
    console.log('🔧 开始修正其他表的外键约束...');

    // 修正community_feedback表
    try {
      await connection.execute('ALTER TABLE community_feedback DROP FOREIGN KEY community_feedback_ibfk_2');
      console.log('已删除community_feedback表的address外键约束');
    } catch (error) {
      console.log('外键约束可能已不存在，继续执行...');
    }

    try {
      await connection.execute('ALTER TABLE community_feedback DROP COLUMN address');
      console.log('已删除community_feedback表的address字段');
    } catch (error) {
      console.log('address字段可能已不存在，继续执行...');
    }

    await connection.execute('ALTER TABLE community_feedback ADD COLUMN location_id BIGINT NOT NULL AFTER feedback_id');
    console.log('已在community_feedback表添加location_id字段');

    await connection.execute(`
      ALTER TABLE community_feedback 
      ADD CONSTRAINT fk_community_feedback_location 
      FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT
    `);
    console.log('已添加community_feedback表的location_id外键约束');

    // 修正evaluation_tasks表
    try {
      await connection.execute('ALTER TABLE evaluation_tasks DROP FOREIGN KEY evaluation_tasks_ibfk_2');
      console.log('已删除evaluation_tasks表的center_address外键约束');
    } catch (error) {
      console.log('外键约束可能已不存在，继续执行...');
    }

    try {
      await connection.execute('ALTER TABLE evaluation_tasks DROP COLUMN center_address');
      console.log('已删除evaluation_tasks表的center_address字段');
    } catch (error) {
      console.log('center_address字段可能已不存在，继续执行...');
    }

    await connection.execute('ALTER TABLE evaluation_tasks ADD COLUMN center_location_id BIGINT NOT NULL AFTER user_id');
    console.log('已在evaluation_tasks表添加center_location_id字段');

    await connection.execute(`
      ALTER TABLE evaluation_tasks 
      ADD CONSTRAINT fk_evaluation_tasks_location 
      FOREIGN KEY (center_location_id) REFERENCES locations(location_id) ON DELETE RESTRICT
    `);
    console.log('已添加evaluation_tasks表的center_location_id外键约束');

    // 步骤7：重新启用外键检查并添加约束
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('已重新启用外键检查');

    // 重新添加facilities表的category外键约束
    await connection.execute(`
      ALTER TABLE facilities 
      ADD CONSTRAINT fk_facilities_category 
      FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE RESTRICT
    `);
    console.log('已重新添加facilities表的category_code外键约束');

    // 步骤8：验证表结构
    console.log('📋 验证新的表结构...');
    
    const [locationsSchema] = await connection.execute('DESCRIBE locations');
    console.log('\n新的locations表结构:');
    console.table(locationsSchema);

    const [facilitiesSchema] = await connection.execute('DESCRIBE facilities');
    console.log('\n修正后的facilities表结构:');
    console.table(facilitiesSchema);

    console.log('\n🎉 数据库表结构修正完成！');
    console.log('✅ locations表已按照CLAUDE.md设计重建');
    console.log('✅ facilities表已修正为使用location_id外键');
    console.log('✅ community_feedback表已修正');
    console.log('✅ evaluation_tasks表已修正');

  } catch (error) {
    console.error('❌ 数据库表结构修正失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此文件，则执行修正
if (require.main === module) {
  updateDatabaseSchema();
}

module.exports = updateDatabaseSchema;
