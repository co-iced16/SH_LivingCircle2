/**
 * 重新初始化数据库表结构
 * 按照CLAUDE.md最新设计重建locations和facilities表
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function reinitializeDatabase() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('连接到数据库成功');

    // 禁用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 删除所有相关表（按依赖顺序）
    const tablesToDrop = [
      'evaluation_result_details',
      'evaluation_target_modes', 
      'evaluation_target_categories',
      'evaluation_tasks',
      'deficiency_analyses',
      'planning_reports',
      'facility_feedback',
      'community_feedback', 
      'feedback_base',
      'facilities',
      'locations'
    ];

    for (const table of tablesToDrop) {
      try {
        await connection.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`已删除表: ${table}`);
      } catch (error) {
        console.log(`删除表 ${table} 失败，可能不存在: ${error.message}`);
      }
    }

    // 重新创建locations表（新结构）
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

    // 重新创建facilities表（新结构）
    await connection.execute(`
      CREATE TABLE facilities (
        facility_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        location_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category_code),
        INDEX idx_location (location_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ 新facilities表创建成功');

    // 重新创建feedback_base表
    await connection.execute(`
      CREATE TABLE feedback_base (
        feedback_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        feedback_type ENUM('community', 'facility') NOT NULL,
        score TINYINT CHECK (score >= 1 AND score <= 5) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        content TEXT,
        INDEX idx_user (user_id),
        INDEX idx_type (feedback_type),
        INDEX idx_submitted_at (submitted_at)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ feedback_base表创建成功');

    // 重新创建community_feedback表
    await connection.execute(`
      CREATE TABLE community_feedback (
        feedback_id BIGINT PRIMARY KEY,
        location_id BIGINT NOT NULL,
        resident_type ENUM('owner', 'tenant', 'visitor') NULL,
        INDEX idx_location (location_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ community_feedback表创建成功');

    // 重新创建facility_feedback表
    await connection.execute(`
      CREATE TABLE facility_feedback (
        feedback_id BIGINT PRIMARY KEY,
        facility_id BIGINT NOT NULL,
        INDEX idx_facility (facility_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ facility_feedback表创建成功');

    // 重新创建evaluation_tasks表
    await connection.execute(`
      CREATE TABLE evaluation_tasks (
        task_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        center_location_id BIGINT NOT NULL,
        radius INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_score DECIMAL(5,2) NULL,
        INDEX idx_user (user_id),
        INDEX idx_location (center_location_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ evaluation_tasks表创建成功');

    // 重新创建evaluation_target_categories表
    await connection.execute(`
      CREATE TABLE evaluation_target_categories (
        task_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        PRIMARY KEY (task_id, category_code)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ evaluation_target_categories表创建成功');

    // 重新创建evaluation_target_modes表
    await connection.execute(`
      CREATE TABLE evaluation_target_modes (
        task_id BIGINT NOT NULL,
        transport_mode VARCHAR(20) NOT NULL,
        PRIMARY KEY (task_id, transport_mode),
        CHECK (transport_mode IN ('walk', 'bus', 'car', 'ride'))
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ evaluation_target_modes表创建成功');

    // 重新创建evaluation_result_details表
    await connection.execute(`
      CREATE TABLE evaluation_result_details (
        detail_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        task_id BIGINT NOT NULL,
        facility_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        transport_mode VARCHAR(20) NOT NULL,
        travel_time INT NULL,
        distance INT NULL,
        INDEX idx_task (task_id),
        INDEX idx_facility (facility_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ evaluation_result_details表创建成功');

    // 重新创建planning_reports表
    await connection.execute(`
      CREATE TABLE planning_reports (
        report_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        admin_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        region_boundary JSON,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin (admin_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ planning_reports表创建成功');

    // 重新创建deficiency_analyses表
    await connection.execute(`
      CREATE TABLE deficiency_analyses (
        deficiency_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        report_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        problem_type ENUM('missing', 'low_score', 'remote') NOT NULL,
        suggestion TEXT,
        INDEX idx_report (report_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ deficiency_analyses表创建成功');

    // 重新启用外键检查并添加外键约束
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // 添加外键约束
    await connection.execute(`
      ALTER TABLE facilities 
      ADD CONSTRAINT fk_facilities_category 
      FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE RESTRICT
    `);
    
    await connection.execute(`
      ALTER TABLE facilities 
      ADD CONSTRAINT fk_facilities_location 
      FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT
    `);

    await connection.execute(`
      ALTER TABLE feedback_base 
      ADD CONSTRAINT fk_feedback_user 
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE community_feedback 
      ADD CONSTRAINT fk_community_feedback_base 
      FOREIGN KEY (feedback_id) REFERENCES feedback_base(feedback_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE community_feedback 
      ADD CONSTRAINT fk_community_feedback_location 
      FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT
    `);

    await connection.execute(`
      ALTER TABLE facility_feedback 
      ADD CONSTRAINT fk_facility_feedback_base 
      FOREIGN KEY (feedback_id) REFERENCES feedback_base(feedback_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE facility_feedback 
      ADD CONSTRAINT fk_facility_feedback_facility 
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE RESTRICT
    `);

    await connection.execute(`
      ALTER TABLE evaluation_tasks 
      ADD CONSTRAINT fk_evaluation_tasks_user 
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE evaluation_tasks 
      ADD CONSTRAINT fk_evaluation_tasks_location 
      FOREIGN KEY (center_location_id) REFERENCES locations(location_id) ON DELETE RESTRICT
    `);

    await connection.execute(`
      ALTER TABLE evaluation_target_categories 
      ADD CONSTRAINT fk_target_categories_task 
      FOREIGN KEY (task_id) REFERENCES evaluation_tasks(task_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE evaluation_target_categories 
      ADD CONSTRAINT fk_target_categories_category 
      FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE evaluation_target_modes 
      ADD CONSTRAINT fk_target_modes_task 
      FOREIGN KEY (task_id) REFERENCES evaluation_tasks(task_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE evaluation_result_details 
      ADD CONSTRAINT fk_result_details_task 
      FOREIGN KEY (task_id) REFERENCES evaluation_tasks(task_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE evaluation_result_details 
      ADD CONSTRAINT fk_result_details_facility 
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE evaluation_result_details 
      ADD CONSTRAINT fk_result_details_category 
      FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE planning_reports 
      ADD CONSTRAINT fk_planning_reports_admin 
      FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE RESTRICT
    `);

    await connection.execute(`
      ALTER TABLE deficiency_analyses 
      ADD CONSTRAINT fk_deficiency_analyses_report 
      FOREIGN KEY (report_id) REFERENCES planning_reports(report_id) ON DELETE CASCADE
    `);

    await connection.execute(`
      ALTER TABLE deficiency_analyses 
      ADD CONSTRAINT fk_deficiency_analyses_category 
      FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE CASCADE
    `);

    console.log('✅ 所有外键约束添加成功');

    // 验证表结构
    const [locationsSchema] = await connection.execute('DESCRIBE locations');
    console.log('\n新的locations表结构:');
    console.table(locationsSchema);

    const [facilitiesSchema] = await connection.execute('DESCRIBE facilities');
    console.log('\n新的facilities表结构:');
    console.table(facilitiesSchema);

    console.log('\n🎉 数据库表结构重建完成！');
    console.log('✅ 所有表已按照CLAUDE.md设计重建');
    console.log('✅ locations表使用location_id作为主键');
    console.log('✅ facilities表使用location_id外键');

  } catch (error) {
    console.error('❌ 数据库表结构重建失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  reinitializeDatabase();
}

module.exports = reinitializeDatabase;
