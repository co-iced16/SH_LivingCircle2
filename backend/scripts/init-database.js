const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  let connection;
  
  try {
    // 首先连接到MySQL服务器（不指定数据库）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log('连接MySQL服务器成功');

    // 创建数据库（如果不存在）
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`数据库 ${process.env.DB_NAME} 创建成功`);

    // 重新连接到指定数据库
    await connection.end();
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log(`连接到数据库 ${process.env.DB_NAME} 成功`);

    // 创建位置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS locations (
        location_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        formatted_address VARCHAR(255) NOT NULL,
        longitude DECIMAL(10, 6) NOT NULL,
        latitude DECIMAL(10, 6) NOT NULL,
        district_code VARCHAR(20),
        INDEX idx_formatted_address (formatted_address),
        INDEX idx_coordinates (longitude, latitude),
        INDEX idx_district_code (district_code)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('位置表创建成功');

    // 创建用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        INDEX idx_username (username)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('用户表创建成功');

    // 创建设施分类表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS facility_categories (
        category_code CHAR(6) PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL,
        parent_code CHAR(6) NULL,
        FOREIGN KEY (parent_code) REFERENCES facility_categories(category_code) ON DELETE SET NULL,
        INDEX idx_parent_code (parent_code)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('设施分类表创建成功');

    // 创建设施表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS facilities (
        facility_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        location_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE RESTRICT,
        FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT,
        INDEX idx_category (category_code),
        INDEX idx_location (location_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('设施表创建成功');

    // 创建反馈基表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS feedback_base (
        feedback_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        feedback_type ENUM('community', 'facility') NOT NULL,
        score TINYINT CHECK (score >= 1 AND score <= 5) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_type (feedback_type),
        INDEX idx_submitted_at (submitted_at)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('反馈基表创建成功');

    // 创建社区反馈表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS community_feedback (
        feedback_id BIGINT PRIMARY KEY,
        location_id BIGINT NOT NULL,
        resident_type ENUM('owner', 'tenant', 'visitor') NULL,
        FOREIGN KEY (feedback_id) REFERENCES feedback_base(feedback_id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT,
        INDEX idx_location (location_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('社区反馈表创建成功');

    // 创建设施反馈表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS facility_feedback (
        feedback_id BIGINT PRIMARY KEY,
        facility_id BIGINT NOT NULL,
        FOREIGN KEY (feedback_id) REFERENCES feedback_base(feedback_id) ON DELETE CASCADE,
        FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE RESTRICT,
        INDEX idx_facility (facility_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('设施反馈表创建成功');

    // 创建评估任务表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS evaluation_tasks (
        task_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        center_location_id BIGINT NOT NULL,
        radius INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_score DECIMAL(5,2) NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (center_location_id) REFERENCES locations(location_id) ON DELETE RESTRICT,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('评估任务表创建成功');

    // 创建评估关注类别表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS evaluation_target_categories (
        task_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        PRIMARY KEY (task_id, category_code),
        FOREIGN KEY (task_id) REFERENCES evaluation_tasks(task_id) ON DELETE CASCADE,
        FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE CASCADE
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('评估关注类别表创建成功');

    // 创建评估交通方式表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS evaluation_target_modes (
        task_id BIGINT NOT NULL,
        transport_mode VARCHAR(20) NOT NULL,
        PRIMARY KEY (task_id, transport_mode),
        FOREIGN KEY (task_id) REFERENCES evaluation_tasks(task_id) ON DELETE CASCADE,
        CHECK (transport_mode IN ('walk', 'bus', 'car', 'ride'))
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('评估交通方式表创建成功');

    // 创建评估结果详情表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS evaluation_result_details (
        detail_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        task_id BIGINT NOT NULL,
        facility_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        transport_mode VARCHAR(20) NOT NULL,
        travel_time INT NULL,
        distance INT NULL,
        FOREIGN KEY (task_id) REFERENCES evaluation_tasks(task_id) ON DELETE CASCADE,
        FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
        FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE CASCADE,
        INDEX idx_task (task_id),
        INDEX idx_facility (facility_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('评估结果详情表创建成功');

    // 创建规划报告表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS planning_reports (
        report_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        admin_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        region_boundary JSON,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE RESTRICT,
        INDEX idx_admin (admin_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('规划报告表创建成功');

    // 创建短板分析表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS deficiency_analyses (
        deficiency_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        report_id BIGINT NOT NULL,
        category_code CHAR(6) NOT NULL,
        problem_type ENUM('missing', 'low_score', 'remote') NOT NULL,
        suggestion TEXT,
        FOREIGN KEY (report_id) REFERENCES planning_reports(report_id) ON DELETE CASCADE,
        FOREIGN KEY (category_code) REFERENCES facility_categories(category_code) ON DELETE CASCADE,
        INDEX idx_report (report_id)
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('短板分析表创建成功');

    // 插入默认设施分类数据（三层分类结构）
    const categories = [
      // 大类
      ['010000', '汽车服务', null],
      ['040000', '摩托车服务', null],
      ['050000', '餐饮服务', null],
      ['060000', '购物服务', null],
      ['070000', '生活服务', null],
      ['080000', '体育休闲服务', null],
      ['090000', '医疗保健服务', null],
      ['110000', '风景名胜', null],
      ['140000', '科教文化服务', null],
      ['150000', '交通设施服务', null],
      ['160000', '金融保险服务', null],

      // 中类和小类
      ['010100', '汽车服务-加油站', '010000'],
      ['010400', '汽车服务-汽车养护/装饰', '010000'],
      
      ['040100', '摩托车服务-摩托车维修', '040000'],
      
      ['050100', '餐饮服务-中餐厅', '050000'],
      ['050200', '餐饮服务-外国餐厅', '050000'],
      ['050300', '餐饮服务-快餐厅', '050000'],
      ['050400', '餐饮服务-休闲餐饮场所', '050000'],
      ['050500', '餐饮服务-咖啡厅', '050000'],
      ['050600', '餐饮服务-茶艺馆', '050000'],
      ['050700', '餐饮服务-冷饮店', '050000'],
      ['050800', '餐饮服务-糕饼店', '050000'],
      ['050900', '餐饮服务-甜品店', '050000'],
      
      ['060100', '购物服务-商场', '060000'],
      ['060200', '购物服务-便民商店/便利店', '060000'],
      ['060300', '购物服务-家电电子卖场', '060000'],
      ['060400', '购物服务-超级市场', '060000'],
      ['060500', '购物服务-花鸟鱼虫市场', '060000'],
      ['060600', '购物服务-家居建材市场', '060000'],
      ['060700', '购物服务-综合市场', '060000'],
      ['060800', '购物服务-文化用品店', '060000'],
      ['060900', '购物服务-体育用品店', '060000'],
      ['061000', '购物服务-特色商业街', '060000'],
      ['061100', '购物服务-服装鞋帽皮具店', '060000'],
      ['061400', '购物服务-个人用品/化妆品店', '060000'],
      
      // 专卖店小类
      ['061201', '购物服务-专卖店-古玩字画', '060000'],
      ['061202', '购物服务-专卖店-珠宝首饰', '060000'],
      ['061203', '购物服务-专卖店-钟表店', '060000'],
      ['061204', '购物服务-专卖店-眼镜店', '060000'],
      ['061205', '购物服务-专卖店-书店', '060000'],
      ['061206', '购物服务-专卖店-音像店', '060000'],
      ['061207', '购物服务-专卖店-儿童用品', '060000'],
      ['061209', '购物服务-专卖店-礼品饰品店', '060000'],
      ['061210', '购物服务-专卖店-烟酒专卖店', '060000'],
      ['061211', '购物服务-专卖店-宠物用品店', '060000'],
      ['061212', '购物服务-专卖店-摄影器材店', '060000'],
      ['061214', '购物服务-专卖店-土特产专卖店', '060000'],
      
      ['070400', '生活服务-邮局', '070000'],
      ['071100', '生活服务-美容美发店', '070000'],
      ['071200', '生活服务-维修站点', '070000'],
      ['071300', '生活服务-摄影冲印店', '070000'],
      ['071400', '生活服务-洗浴推拿场所', '070000'],
      ['071500', '生活服务-洗衣店', '070000'],
      ['072000', '生活服务-婴儿服务场所', '070000'],
      
      // 电讯营业厅小类
      ['070601', '生活服务-电讯营业厅-中国电信营业厅', '070000'],
      ['070602', '生活服务-电讯营业厅-中国移动营业厅', '070000'],
      ['070603', '生活服务-电讯营业厅-中国联通营业厅', '070000'],
      
      ['080100', '体育休闲服务-运动场馆', '080000'],
      ['080200', '体育休闲服务-高尔夫相关', '080000'],
      ['080300', '体育休闲服务-娱乐场所', '080000'],
      ['080500', '体育休闲服务-休闲场所', '080000'],
      ['080600', '体育休闲服务-影剧院', '080000'],
      
      ['090100', '医疗保健服务-综合医院', '090000'],
      ['090300', '医疗保健服务-诊所', '090000'],
      ['090600', '医疗保健服务-医药保健销售店', '090000'],
      ['090700', '医疗保健服务-动物医疗场所', '090000'],
      
      // 专科医院小类
      ['090202', '医疗保健服务-专科医院-口腔医院', '090000'],
      ['090203', '医疗保健服务-专科医院-眼科医院', '090000'],
      ['090204', '医疗保健服务-专科医院-耳鼻喉医院', '090000'],
      
      ['140500', '科教文化服务-图书馆', '140000'],
      ['140800', '科教文化服务-文化宫', '140000'],
      
      // 学校小类
      ['141202', '科教文化服务-学校-中学', '140000'],
      ['141203', '科教文化服务-学校-小学', '140000'],
      ['141204', '科教文化服务-学校-幼儿园', '140000'],
      
      // 机场相关小类
      ['150104', '交通设施服务-机场相关-飞机场', '150000'],
      
      // 火车站小类
      ['150202', '交通设施服务-火车站-进站口/检票口', '150000'],
      
      // 长途汽车站小类
      ['150401', '交通设施服务-长途汽车站-进站', '150000'],
      
      // 地铁站小类
      ['150501', '交通设施服务-地铁站-出入口', '150000'],
      
      ['150700', '交通设施服务-公交车站', '150000'],
      ['150900', '交通设施服务-停车场', '150000'],
      
      ['160100', '金融保险服务-银行', '160000'],
      ['160300', '金融保险服务-自动提款机', '160000']
    ];

    for (const [category_code, category_name, parent_code] of categories) {
      await connection.execute(
        'INSERT IGNORE INTO facility_categories (category_code, category_name, parent_code) VALUES (?, ?, ?)',
        [category_code, category_name, parent_code]
      );
    }
    console.log('默认设施分类数据插入成功');

    // 创建默认管理员用户
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT IGNORE INTO users (username, password_hash, email, role) 
      VALUES ('admin', ?, 'admin@example.com', 'admin')
    `, [adminPassword]);
    console.log('默认管理员用户创建成功 (用户名: admin, 密码: admin123)');

    // 创建测试用户
    const testPassword = await bcrypt.hash('123456', 10);
    await connection.execute(`
      INSERT IGNORE INTO users (username, password_hash, email, role) 
      VALUES ('demo', ?, 'demo@example.com', 'user')
    `, [testPassword]);
    console.log('测试用户创建成功 (用户名: demo, 密码: 123456)');

    console.log('🎉 数据库初始化完成！');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此文件，则执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
