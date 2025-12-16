/**
 * 数据重复检查和清理工具
 * 用于检测和处理facilities表中的重复数据
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sh_living_circle1',
  charset: 'utf8mb4'
};

class DataDuplicateChecker {
  constructor() {
    this.connection = null;
  }

  async connect() {
    this.connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }

  /**
   * 检查完全重复的设施（名称+位置+分类完全相同）
   */
  async checkExactDuplicates() {
    console.log('\n🔍 检查完全重复的设施...');
    
    const [duplicates] = await this.connection.execute(`
      SELECT 
        f.name,
        l.formatted_address,
        f.category_code,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(f.facility_id ORDER BY f.facility_id) as facility_ids
      FROM facilities f
      JOIN locations l ON f.location_id = l.location_id
      GROUP BY f.name, l.formatted_address, f.category_code
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `);

    if (duplicates.length === 0) {
      console.log('✅ 没有发现完全重复的设施');
      return [];
    }

    console.log(`❌ 发现 ${duplicates.length} 组完全重复的设施：`);
    console.table(duplicates);
    
    return duplicates;
  }

  /**
   * 检查相似名称的设施（同一位置，相似名称）
   */
  async checkSimilarFacilities() {
    console.log('\n🔍 检查相似名称的设施...');
    
    const [similar] = await this.connection.execute(`
      SELECT 
        f1.facility_id as facility_id_1,
        f1.name as name_1,
        f2.facility_id as facility_id_2, 
        f2.name as name_2,
        l.formatted_address,
        f1.category_code
      FROM facilities f1
      JOIN facilities f2 ON f1.location_id = f2.location_id 
                        AND f1.category_code = f2.category_code
                        AND f1.facility_id < f2.facility_id
      JOIN locations l ON f1.location_id = l.location_id
      WHERE (f1.name LIKE CONCAT('%', SUBSTRING(f2.name, 1, 3), '%') 
             OR f2.name LIKE CONCAT('%', SUBSTRING(f1.name, 1, 3), '%'))
      ORDER BY l.formatted_address, f1.name
    `);

    if (similar.length === 0) {
      console.log('✅ 没有发现相似名称的设施');
      return [];
    }

    console.log(`⚠️ 发现 ${similar.length} 对相似名称的设施：`);
    console.table(similar);
    
    return similar;
  }

  /**
   * 检查同一位置的设施密度
   */
  async checkLocationDensity() {
    console.log('\n🔍 检查位置设施密度...');
    
    const [density] = await this.connection.execute(`
      SELECT 
        l.location_id,
        l.formatted_address,
        COUNT(f.facility_id) as facility_count,
        GROUP_CONCAT(DISTINCT f.category_code ORDER BY f.category_code) as categories
      FROM locations l
      JOIN facilities f ON l.location_id = f.location_id
      GROUP BY l.location_id, l.formatted_address
      HAVING COUNT(f.facility_id) > 5
      ORDER BY facility_count DESC
      LIMIT 20
    `);

    if (density.length === 0) {
      console.log('✅ 位置设施密度正常');
      return [];
    }

    console.log(`📊 位置设施密度最高的前20个位置：`);
    console.table(density);
    
    return density;
  }

  /**
   * 检查重复位置（相同坐标不同地址）
   */
  async checkDuplicateLocations() {
    console.log('\n🔍 检查重复位置...');
    
    const [duplicateLocations] = await this.connection.execute(`
      SELECT 
        longitude,
        latitude,
        COUNT(*) as location_count,
        GROUP_CONCAT(DISTINCT formatted_address ORDER BY formatted_address SEPARATOR ' | ') as addresses,
        GROUP_CONCAT(location_id ORDER BY location_id) as location_ids
      FROM locations
      GROUP BY ROUND(longitude, 4), ROUND(latitude, 4)
      HAVING COUNT(*) > 1
      ORDER BY location_count DESC
    `);

    if (duplicateLocations.length === 0) {
      console.log('✅ 没有发现重复位置');
      return [];
    }

    console.log(`❌ 发现 ${duplicateLocations.length} 组重复位置：`);
    console.table(duplicateLocations);
    
    return duplicateLocations;
  }

  /**
   * 获取数据库整体统计
   */
  async getOverallStats() {
    console.log('\n📊 数据库整体统计：');
    
    const [stats] = await this.connection.execute(`
      SELECT 
        COUNT(DISTINCT f.facility_id) as total_facilities,
        COUNT(DISTINCT f.location_id) as total_locations,
        COUNT(DISTINCT f.category_code) as total_categories,
        COUNT(DISTINCT CONCAT(f.name, '-', f.location_id)) as unique_name_location_pairs
      FROM facilities f
    `);

    const [categoryStats] = await this.connection.execute(`
      SELECT 
        fc.category_name,
        COUNT(f.facility_id) as facility_count
      FROM facility_categories fc
      LEFT JOIN facilities f ON fc.category_code = f.category_code
      WHERE fc.parent_code IS NOT NULL
      GROUP BY fc.category_code, fc.category_name
      HAVING COUNT(f.facility_id) > 0
      ORDER BY facility_count DESC
      LIMIT 10
    `);

    console.table(stats);
    console.log('\n📈 设施数量最多的前10个分类：');
    console.table(categoryStats);
  }

  /**
   * 清理完全重复的设施
   */
  async cleanExactDuplicates(dryRun = true) {
    const duplicates = await this.checkExactDuplicates();
    
    if (duplicates.length === 0) {
      console.log('✅ 没有需要清理的重复数据');
      return 0;
    }

    let cleanedCount = 0;
    
    for (const duplicate of duplicates) {
      const facilityIds = duplicate.facility_ids.split(',');
      const keepId = facilityIds[0]; // 保留第一个
      const deleteIds = facilityIds.slice(1); // 删除其余的
      
      if (dryRun) {
        console.log(`🧹 [模拟] 保留设施 ${keepId}，删除设施 ${deleteIds.join(', ')}`);
        cleanedCount += deleteIds.length;
      } else {
        try {
          const [result] = await this.connection.execute(
            `DELETE FROM facilities WHERE facility_id IN (${deleteIds.map(() => '?').join(',')})`,
            deleteIds
          );
          console.log(`🧹 保留设施 ${keepId}，删除了 ${result.affectedRows} 个重复设施`);
          cleanedCount += result.affectedRows;
        } catch (error) {
          console.error(`❌ 删除失败:`, error);
        }
      }
    }

    if (dryRun) {
      console.log(`\n📋 模拟清理完成，将删除 ${cleanedCount} 个重复设施`);
      console.log('💡 如需实际执行清理，请使用参数 --execute');
    } else {
      console.log(`\n✅ 清理完成，删除了 ${cleanedCount} 个重复设施`);
    }

    return cleanedCount;
  }

  /**
   * 运行完整检查
   */
  async runFullCheck() {
    console.log('🚀 开始数据重复检查...');
    
    await this.getOverallStats();
    await this.checkExactDuplicates();
    await this.checkSimilarFacilities();
    await this.checkLocationDensity();
    await this.checkDuplicateLocations();
    
    console.log('\n✅ 检查完成');
  }
}

async function main() {
  const checker = new DataDuplicateChecker();
  
  try {
    await checker.connect();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'check';
    
    switch (command) {
      case 'check':
        await checker.runFullCheck();
        break;
        
      case 'clean':
        await checker.cleanExactDuplicates(true); // 模拟清理
        break;
        
      case 'clean-execute':
        console.log('⚠️ 即将执行实际清理操作...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await checker.cleanExactDuplicates(false); // 实际清理
        break;
        
      default:
        console.log('📖 使用方法:');
        console.log('  node check-duplicates.js check           # 检查重复数据');
        console.log('  node check-duplicates.js clean           # 模拟清理重复数据');
        console.log('  node check-duplicates.js clean-execute   # 实际清理重复数据');
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error);
  } finally {
    await checker.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { DataDuplicateChecker };
