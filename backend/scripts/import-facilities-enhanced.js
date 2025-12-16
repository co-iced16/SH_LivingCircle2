/**
 * 增强版设施数据导入脚本
 * 支持混合搜索策略：关键词搜索 + 分类名称搜索
 * 
 * 新增功能:
 * 1. 自动为所有分类生成搜索关键词
 * 2. 优先使用人工配置的关键词，备用自动生成的关键词
 * 3. 覆盖数据库中的所有facility_categories
 * 4. 更全面的数据导入策略
 */

const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const {
  IMPORT_CONFIG,
  SHANGHAI_DISTRICTS,
  SEARCH_KEYWORDS,
  SEARCH_STRATEGY,
  generateCategoryKeywords,
  validateConfig
} = require('./import-config');

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sh_living_circle1',
  charset: 'utf8mb4'
};

// 高德地图API配置
const AMAP_API_KEY = process.env.AMAP_API_KEY || 'c1e16b086f32deeb23220fa56172a151';
const AMAP_BASE_URL = 'https://restapi.amap.com/v3/place/text';

// 日志工具
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${new Date().toLocaleTimeString()} ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${new Date().toLocaleTimeString()} ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${new Date().toLocaleTimeString()} ${message}`, ...args)
};

/**
 * 增强版设施导入器
 */
class EnhancedFacilityImporter {
  constructor() {
    this.connection = null;
  }

  /**
   * 连接数据库
   */
  async connect() {
    try {
      this.connection = await mysql.createConnection(dbConfig);
      logger.info('数据库连接成功');
    } catch (error) {
      logger.error('数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      logger.info('数据库连接已关闭');
    }
  }

  /**
   * 获取所有设施分类
   */
  async getAllCategories() {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [rows] = await this.connection.execute(`
      SELECT category_code, category_name, parent_code
      FROM facility_categories 
      WHERE parent_code IS NOT NULL  -- 只获取子分类
      ORDER BY category_code
    `);

    return rows;
  }

  /**
   * 获取分类的搜索关键词（混合策略）
   */
  getCategorySearchKeywords(categoryCode, categoryName) {
    let keywords = [];

    // 1. 优先使用人工配置的关键词
    if (SEARCH_KEYWORDS[categoryCode]) {
      keywords = [...SEARCH_KEYWORDS[categoryCode]];
      logger.info(`🎯 分类 ${categoryCode} 使用人工配置关键词: ${keywords.join(', ')}`);
    } 
    // 2. 备用自动生成关键词
    else {
      keywords = generateCategoryKeywords(categoryName);
      logger.info(`🤖 分类 ${categoryCode} 使用自动生成关键词: ${keywords.join(', ')}`);
    }

    // 3. 添加分类名称本身作为备用
    const cleanCategoryName = categoryName.replace(/^.*?-/, '').trim();
    if (!keywords.includes(cleanCategoryName)) {
      keywords.push(cleanCategoryName);
    }

    return keywords;
  }

  /**
   * 高德API搜索POI
   */
  async searchPOI(keyword, district = null, page = 1, pageSize = 20) {
    try {
      const params = {
        key: AMAP_API_KEY,
        keywords: keyword,
        city: district ? district.name : '上海',
        output: 'json',
        page: page,
        offset: pageSize
      };

      const response = await axios.get(AMAP_BASE_URL, {
        params,
        timeout: IMPORT_CONFIG.API_LIMITS.TIMEOUT
      });

      if (response.data.status !== '1') {
        logger.error(`API请求失败: ${response.data.info}`);
        return [];
      }

      const pois = response.data.pois || [];
      return pois.map(poi => ({
        name: poi.name,
        address: poi.address,
        longitude: parseFloat(poi.location?.split(',')[0] || 0),
        latitude: parseFloat(poi.location?.split(',')[1] || 0),
        adcode: poi.adcode,
        citycode: poi.citycode
      })).filter(poi => poi.longitude && poi.latitude);

    } catch (error) {
      logger.error(`搜索POI失败 [${keyword}]:`, error.message);
      return [];
    }
  }

  /**
   * 验证设施数据是否有效
   */
  isValidFacility(poi) {
    const config = IMPORT_CONFIG.DATA_FILTER;
    
    // 检查名称长度
    if (!poi.name || poi.name.length < config.MIN_NAME_LENGTH || poi.name.length > config.MAX_NAME_LENGTH) {
      return false;
    }
    
    // 检查地址长度
    if (!poi.address || poi.address.length < config.MIN_ADDRESS_LENGTH) {
      return false;
    }
    
    // 检查地址是否包含必需关键词
    const hasRequiredKeywords = config.REQUIRED_ADDRESS_KEYWORDS.some(keyword => 
      poi.address.includes(keyword)
    );
    if (!hasRequiredKeywords) {
      return false;
    }
    
    // 检查名称是否包含排除的关键词
    const hasExcludedKeywords = config.EXCLUDED_NAME_KEYWORDS.some(keyword => 
      poi.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasExcludedKeywords) {
      return false;
    }
    
    return true;
  }

  /**
   * 提取行政区划代码
   */
  extractDistrictCode(address) {
    const districtMappings = {
      '黄浦区': '310101', '徐汇区': '310104', '长宁区': '310105', '静安区': '310106',
      '普陀区': '310107', '虹口区': '310109', '杨浦区': '310110', '浦东新区': '310115',
      '闵行区': '310112', '宝山区': '310113', '嘉定区': '310114', '松江区': '310117',
      '青浦区': '310118', '奉贤区': '310120', '金山区': '310116', '崇明区': '310151'
    };

    for (const [district, code] of Object.entries(districtMappings)) {
      if (address.includes(district)) {
        return code;
      }
    }
    return null;
  }

  /**
   * 插入或更新位置数据（增强去重）
   */
  async insertLocation(address, longitude, latitude, districtCode = null) {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    // 方法1：精确地址匹配
    const [exactMatch] = await this.connection.execute(
      'SELECT location_id FROM locations WHERE formatted_address = ?',
      [address]
    );

    if (exactMatch.length > 0) {
      return exactMatch[0].location_id;
    }

    // 方法2：坐标距离匹配（避免同一位置不同地址表述）
    const [nearbyMatch] = await this.connection.execute(
      `SELECT location_id, formatted_address,
              (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance
       FROM locations 
       HAVING distance < 0.05  -- 50米内视为同一位置
       ORDER BY distance 
       LIMIT 1`,
      [latitude, longitude, latitude]
    );

    if (nearbyMatch.length > 0) {
      logger.info(`🔄 发现附近位置: ${nearbyMatch[0].formatted_address}，复用location_id: ${nearbyMatch[0].location_id}`);
      return nearbyMatch[0].location_id;
    }

    // 插入新位置
    const [result] = await this.connection.execute(
      'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
      [address, longitude, latitude, districtCode]
    );

    return result.insertId;
  }

  /**
   * 插入设施数据（增强去重）
   */
  async insertFacility(facilityData) {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    try {
      const districtCode = this.extractDistrictCode(facilityData.address);
      
      const locationId = await this.insertLocation(
        facilityData.address,
        facilityData.longitude,
        facilityData.latitude,
        districtCode
      );

      // 方法1：精确匹配（名称+位置+分类）
      const [exactMatch] = await this.connection.execute(
        'SELECT facility_id FROM facilities WHERE name = ? AND location_id = ? AND category_code = ?',
        [facilityData.name, locationId, facilityData.category_code]
      );

      if (exactMatch.length > 0) {
        return { success: false, reason: '精确匹配已存在' };
      }

      // 方法2：模糊匹配（相似名称+相同位置）
      const [similarMatch] = await this.connection.execute(
        `SELECT facility_id, name FROM facilities 
         WHERE location_id = ? 
         AND category_code = ? 
         AND (name = ? OR name LIKE ? OR ? LIKE CONCAT('%', name, '%'))`,
        [locationId, facilityData.category_code, facilityData.name, `%${facilityData.name}%`, facilityData.name]
      );

      if (similarMatch.length > 0) {
        logger.info(`🔄 发现相似设施: "${similarMatch[0].name}" vs "${facilityData.name}"，跳过导入`);
        return { success: false, reason: '相似名称已存在' };
      }

      // 方法3：检查是否同一设施被归入不同分类
      const [crossCategoryMatch] = await this.connection.execute(
        'SELECT facility_id, category_code FROM facilities WHERE name = ? AND location_id = ?',
        [facilityData.name, locationId]
      );

      if (crossCategoryMatch.length > 0) {
        logger.info(`🏷️ 设施 "${facilityData.name}" 已存在于分类 ${crossCategoryMatch[0].category_code}，添加到分类 ${facilityData.category_code}`);
        // 允许同一设施归入多个分类
      }

      // 插入设施
      await this.connection.execute(
        'INSERT INTO facilities (name, location_id, category_code) VALUES (?, ?, ?)',
        [facilityData.name, locationId, facilityData.category_code]
      );

      return { success: true, reason: '成功插入' };
    } catch (error) {
      logger.error(`插入设施失败: ${facilityData.name}`, error);
      return { success: false, reason: `错误: ${error.message}` };
    }
  }

  /**
   * 导入指定分类的设施数据
   */
  async importCategoryFacilities(category, districts = SHANGHAI_DISTRICTS) {
    const { category_code, category_name } = category;
    logger.info(`🏢 开始导入分类 ${category_code}: ${category_name}`);

    const keywords = this.getCategorySearchKeywords(category_code, category_name);
    const allFacilities = [];

    // 对每个关键词进行搜索
    for (const keyword of keywords) {
      logger.info(`🔍 搜索关键词: ${keyword}`);

      // 在各个区域搜索
      for (const district of districts.slice(0, 12)) { // 扩展到前12个区域
        try {
          const pois = await this.searchPOI(keyword, district);
          
          for (const poi of pois) {
            if (this.isValidFacility(poi)) {
              allFacilities.push({
                name: poi.name,
                address: poi.address,
                longitude: poi.longitude,
                latitude: poi.latitude,
                category_code: category_code
              });
            }
          }

          // API限流
          await new Promise(resolve => setTimeout(resolve, IMPORT_CONFIG.API_LIMITS.REQUEST_DELAY));
        } catch (error) {
          logger.error(`搜索失败 [${keyword}@${district.name}]:`, error);
        }
      }
    }

    // 去重
    const uniqueFacilities = allFacilities.filter((facility, index, array) => {
      return index === array.findIndex(f => 
        f.name === facility.name && f.address === facility.address
      );
    });

    // 插入数据库
    let imported = 0;
    let skipped = 0;
    const skipReasons = {};

    for (const facility of uniqueFacilities) {
      const result = await this.insertFacility(facility);
      if (result.success) {
        imported++;
        if (imported % 10 === 0) {
          logger.info(`💾 已插入 ${imported}/${uniqueFacilities.length} 个设施...`);
        }
      } else {
        skipped++;
        skipReasons[result.reason] = (skipReasons[result.reason] || 0) + 1;
      }
    }

    logger.info(`✅ 分类 ${category_code} 导入完成：`);
    logger.info(`   🔍 搜索到: ${uniqueFacilities.length} 个设施`);
    logger.info(`   ✅ 成功导入: ${imported} 个`);
    logger.info(`   ⏭️ 跳过重复: ${skipped} 个`);
    
    if (skipped > 0) {
      logger.info(`   📊 跳过原因统计:`);
      Object.entries(skipReasons).forEach(([reason, count]) => {
        logger.info(`      - ${reason}: ${count} 个`);
      });
    }

    return imported;
  }

  /**
   * 获取导入统计
   */
  async getImportStats() {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [stats] = await this.connection.execute(`
      SELECT 
        fc.category_code,
        fc.category_name,
        COUNT(f.facility_id) as facility_count
      FROM facility_categories fc
      LEFT JOIN facilities f ON fc.category_code = f.category_code
      WHERE fc.parent_code IS NOT NULL
      GROUP BY fc.category_code, fc.category_name
      ORDER BY facility_count DESC, fc.category_code
      LIMIT 20
    `);

    const [totals] = await this.connection.execute(`
      SELECT 
        COUNT(DISTINCT f.facility_id) as total_facilities,
        COUNT(DISTINCT f.location_id) as total_locations,
        COUNT(DISTINCT f.category_code) as categories_with_data
      FROM facilities f
    `);

    logger.info('📈 设施导入统计（TOP 20）:');
    console.table(stats);
    
    const total = totals[0];
    logger.info(`📋 汇总统计:`);
    logger.info(`   🏢 设施总数: ${total.total_facilities} 个`);
    logger.info(`   📍 位置总数: ${total.total_locations} 个`);
    logger.info(`   📂 有数据分类: ${total.categories_with_data} 个`);
  }
}

/**
 * 主导入程序
 */
async function main() {
  logger.info('🚀 开始增强版设施数据导入');
  
  // 验证配置
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    logger.error('配置验证失败:');
    configErrors.forEach(error => logger.error(`- ${error}`));
    process.exit(1);
  }

  const importer = new EnhancedFacilityImporter();

  try {
    await importer.connect();

    // 获取所有分类
    const categories = await importer.getAllCategories();
    logger.info(`📋 从数据库获取到 ${categories.length} 个设施分类`);

    // 分批导入
    const batchSize = IMPORT_CONFIG.API_LIMITS.BATCH_SIZE;
    let totalImported = 0;

    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      logger.info(`\n🔄 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(categories.length / batchSize)}`);
      
      for (const category of batch) {
        const imported = await importer.importCategoryFacilities(category);
        totalImported += imported;
        
        // 批次间延迟
        await new Promise(resolve => setTimeout(resolve, IMPORT_CONFIG.API_LIMITS.BATCH_DELAY));
      }
    }

    // 显示最终统计
    logger.info(`\n🎉 导入完成！总共导入 ${totalImported} 个设施`);
    await importer.getImportStats();

  } catch (error) {
    logger.error('导入过程出错:', error);
  } finally {
    await importer.disconnect();
  }
}

// 运行主程序
if (require.main === module) {
  main().catch(error => {
    logger.error('程序执行失败:', error);
    process.exit(1);
  });
}

module.exports = { EnhancedFacilityImporter };
