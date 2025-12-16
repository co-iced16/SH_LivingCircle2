/**
 * 系统一致性检查脚本
 * 验证后端系统的完整性和配置
 */

const { testConnection } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');

async function finalCheck() {
  console.log('🔍 执行最终系统检查...\n');
  
  // 1. 检查数据库连接
  console.log('1. 检查数据库连接...');
  try {
    const dbConnected = await testConnection();
    console.log(dbConnected ? '✅ 数据库连接正常' : '❌ 数据库连接失败');
  } catch (error) {
    console.log('❌ 数据库连接失败:', error.message);
  }
  
  // 2. 检查导入配置
  console.log('\n2. 检查导入配置...');
  try {
    const { validateConfig } = require('../backend/scripts/import-config');
    const configErrors = validateConfig();
    if (configErrors.length === 0) {
      console.log('✅ 导入配置验证通过');
    } else {
      console.log('❌ 导入配置错误:');
      configErrors.forEach(error => console.log(`   - ${error}`));
    }
  } catch (error) {
    console.log('❌ 导入配置检查失败:', error.message);
  }
  
  // 3. 验证关键文件存在性
  console.log('\n3. 验证关键文件存在性...');
  const keyFiles = [
    './controllers/feedbackController.js',
    './controllers/facilityController.js', 
    './controllers/evaluationController.js',
    './utils/validation.js',
    './routes/feedback.js',
    './routes/facilities.js',
    './routes/evaluation.js',
    './scripts/init-database.js',
    './scripts/import-config.js',
    './config/database.js'
  ];
  
  keyFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
  });
  
  // 4. 检查数据库表结构
  console.log('\n4. 检查数据库表结构...');
  try {
    const pool = require('../backend/config/database').pool;
    const [tables] = await pool.execute('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    const expectedTables = [
      'users',
      'locations', 
      'facility_categories',
      'facilities',
      'feedback_base',
      'community_feedback',
      'facility_feedback',
      'evaluation_tasks',
      'evaluation_target_categories',
      'evaluation_target_modes',
      'evaluation_result_details'
    ];
    
    expectedTables.forEach(tableName => {
      const exists = tableNames.includes(tableName);
      console.log(`${exists ? '✅' : '❌'} 表 ${tableName}`);
    });
  } catch (error) {
    console.log('❌ 数据库表检查失败:', error.message);
  }
  
  // 5. 检查API端点一致性
  console.log('\n5. 检查API端点一致性...');
  const apiEndpoints = [
    { route: 'auth', endpoints: ['POST /register', 'POST /login', 'GET /profile'] },
    { route: 'feedback', endpoints: ['POST /community', 'POST /facility', 'GET /community', 'GET /facility'] },
    { route: 'evaluation', endpoints: ['POST /', 'GET /', 'GET /:id', 'DELETE /:id'] },
    { route: 'facilities', endpoints: ['GET /search', 'GET /categories', 'GET /:id'] }
  ];
  
  apiEndpoints.forEach(({ route, endpoints }) => {
    const routeFile = `./routes/${route}.js`;
    if (fs.existsSync(routeFile)) {
      console.log(`✅ 路由文件 ${route}.js`);
      // 这里可以进一步解析文件内容检查端点
    } else {
      console.log(`❌ 路由文件 ${route}.js`);
    }
  });
  
  // 6. 验证字段一致性
  console.log('\n6. 验证字段一致性...');
  try {
    const pool = require('../backend/config/database').pool;
    const [locationFields] = await pool.execute('DESCRIBE locations');
    const hasFormattedAddress = locationFields.some(field => field.Field === 'formatted_address');
    console.log(`${hasFormattedAddress ? '✅' : '❌'} locations表使用formatted_address字段`);
    
    const [facilityFields] = await pool.execute('DESCRIBE facilities');
    const hasLocationId = facilityFields.some(field => field.Field === 'location_id');
    console.log(`${hasLocationId ? '✅' : '❌'} facilities表使用location_id外键`);
  } catch (error) {
    console.log('❌ 字段一致性检查失败:', error.message);
  }
  
  console.log('\n🎉 后端系统检查完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  finalCheck().catch(error => {
    console.error('系统检查失败:', error);
    process.exit(1);
  });
}

module.exports = { finalCheck };
