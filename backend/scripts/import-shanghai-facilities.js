/**
 * 上海市设施数据导入脚本
 * 通过高德地图API导入设施数据到当前数据库结构
 * 
 * 功能特性:
 * - 基于数据库中的facility_categories表进行导入
 * - 覆盖上海市16个行政区域
 * - 使用高德地图POI搜索API
 * - 自动更新locations位置表
 * - 智能去重处理，避免重复导入
 * - API频率限制控制
 * 
 * 数据库表结构适配:
 * - locations (location_id, formatted_address, longitude, latitude, district_code)
 * - facilities (facility_id, name, location_id, category_code, last_updated)
 * - facility_categories (category_code, category_name, parent_code)
 */

const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const {
  IMPORT_CONFIG,
  PRIORITY_CATEGORIES,
  SHANGHAI_DISTRICTS,
  BATCH_IMPORT_STRATEGY,
  SEARCH_KEYWORDS,
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

// 简单日志工具
const logger = {
  info: (message, ...args) => {
    console.log(`[INFO] ${new Date().toLocaleTimeString()} ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${new Date().toLocaleTimeString()} ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${new Date().toLocaleTimeString()} ${message}`, ...args);
  }
};

/**
 * 高德地图API服务类
 */
class AmapService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * 验证API密钥是否有效
   */
  async checkApiKey() {
    try {
      const response = await axios.get(AMAP_BASE_URL, {
        params: {
          key: this.apiKey,
          keywords: '测试',
          city: '上海',
          output: 'json'
        },
        timeout: 5000
      });
      
      return response.data && response.data.status === '1';
    } catch (error) {
      logger.error('API密钥验证失败:', error.message);
      return false;
    }
  }

  /**
   * 搜索POI
   */
  async searchPOI(keyword, city = '上海', types = '', page = 1, pageSize = 20) {
    try {
      const params = {
        key: this.apiKey,
        keywords: keyword,
        city: city,
        output: 'json',
        page: page,
        offset: pageSize
      };

      if (types) {
        params.types = types;
      }

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
}

/**
 * 设施数据导入器
 */
class FacilityImporter {
  constructor() {
    this.connection = null;
    this.amapService = new AmapService(AMAP_API_KEY);
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
   * 获取现有的设施分类
   */
  async getFacilityCategories() {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [rows] = await this.connection.execute(`
      SELECT category_code, category_name, parent_code
      FROM facility_categories 
      ORDER BY category_code
    `);

    return rows;
  }

  /**
   * 检查数据库现有数据状态
   */
  async checkDataStatus() {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [facilityCount] = await this.connection.execute('SELECT COUNT(*) as count FROM facilities');
    const [locationCount] = await this.connection.execute('SELECT COUNT(*) as count FROM locations');
    
    return {
      facilityCount: facilityCount[0].count,
      locationCount: locationCount[0].count
    };
  }

  /**
   * 检查位置是否已存在
   */
  async checkLocationExists(address) {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [rows] = await this.connection.execute(
      'SELECT location_id FROM locations WHERE formatted_address = ?',
      [address]
    );

    return rows.length > 0 ? rows[0].location_id : null;
  }

  /**
   * 插入位置数据，返回location_id
   */
  async insertLocation(address, longitude, latitude, districtCode = null) {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    // 检查是否已存在
    const existingLocationId = await this.checkLocationExists(address);
    if (existingLocationId) {
      return existingLocationId;
    }

    // 插入新位置
    const [result] = await this.connection.execute(
      'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
      [address, longitude, latitude, districtCode]
    );

    return result.insertId;
  }

  /**
   * 检查设施是否已存在
   */
  async checkFacilityExists(name, locationId, categoryCode) {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [rows] = await this.connection.execute(
      'SELECT facility_id FROM facilities WHERE name = ? AND location_id = ? AND category_code = ?',
      [name, locationId, categoryCode]
    );

    return rows.length > 0;
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
   * 插入设施数据
   */
  async insertFacility(facilityData) {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    try {
      // 提取区域代码（可以从地址中提取，或从高德API获取）
      const districtCode = this.extractDistrictCode(facilityData.address);
      
      // 插入位置数据并获取location_id
      const locationId = await this.insertLocation(
        facilityData.address, 
        facilityData.longitude, 
        facilityData.latitude,
        districtCode
      );

      // 检查设施是否已存在
      const exists = await this.checkFacilityExists(
        facilityData.name, 
        locationId, 
        facilityData.category_code
      );

      if (exists) {
        return;
      }

      // 插入设施
      await this.connection.execute(
        'INSERT INTO facilities (name, location_id, category_code, last_updated) VALUES (?, ?, ?, NOW())',
        [facilityData.name, locationId, facilityData.category_code]
      );

    } catch (error) {
      logger.error(`插入设施失败: ${facilityData.name} - ${facilityData.address}`, error);
      throw error;
    }
  }

  /**
   * 从地址中提取区域代码（简单实现）
   */
  extractDistrictCode(address) {
    // 简单的区域代码提取逻辑
    const districtMappings = {
      '黄浦区': '310101',
      '徐汇区': '310104', 
      '长宁区': '310105',
      '静安区': '310106',
      '普陀区': '310107',
      '虹口区': '310109',
      '杨浦区': '310110',
      '浦东新区': '310115',
      '闵行区': '310112',
      '宝山区': '310113',
      '嘉定区': '310114',
      '松江区': '310117',
      '青浦区': '310118',
      '奉贤区': '310120',
      '金山区': '310116',
      '崇明区': '310151'
    };

    for (const [district, code] of Object.entries(districtMappings)) {
      if (address.includes(district)) {
        return code;
      }
    }

    return null; // 无法识别区域
  }

  /**
   * 从高德API搜索设施
   */
  async searchFacilitiesFromAmap(categoryCode, districts = SHANGHAI_DISTRICTS) {
    const keywords = SEARCH_KEYWORDS[categoryCode];
    if (!keywords || keywords.length === 0) {
      logger.warn(`分类 ${categoryCode} 没有配置搜索关键词`);
      return [];
    }

    const facilities = [];
    
    for (const keyword of keywords) {
      logger.info(`🔍 搜索关键词: ${keyword} (分类: ${categoryCode})`);

      try {
        // 在指定区域分别进行搜索
        for (const district of districts.slice(0, 8)) { // 限制前8个主要区域
          logger.info(`📍 在${district.name}搜索: ${keyword}`);

          const pois = await this.amapService.searchPOI(
            keyword,
            district.name,
            '',  // 不限制types，让高德自动匹配
            1,   // 第1页
            IMPORT_CONFIG.SEARCH_CONFIG.MAX_RESULTS_PER_REQUEST
          );

          for (const poi of pois) {
            if (poi.longitude && poi.latitude && poi.address && poi.name) {
              // 验证地址包含上海市和对应区域
              const isInShanghai = poi.address.includes('上海') || poi.address.includes('沪');
              const districtKeywords = [
                district.name,
                district.name.replace('区', ''),
                district.name.replace('新区', ''),
              ];
              const isInCorrectDistrict = districtKeywords.some(keyword => 
                poi.address.includes(keyword)
              );
              
              if (isInShanghai && isInCorrectDistrict && this.isValidFacility(poi)) {
                facilities.push({
                  name: poi.name,
                  address: poi.address,
                  longitude: poi.longitude,
                  latitude: poi.latitude,
                  category_code: categoryCode
                });
              }
            }
          }

          // API限流
          await new Promise(resolve => setTimeout(resolve, IMPORT_CONFIG.API_LIMITS.REQUEST_DELAY));
        }
      } catch (error) {
        logger.error(`搜索关键词 ${keyword} 失败:`, error);
      }
    }

    // 去重（基于名称和地址）
    const uniqueFacilities = facilities.filter((facility, index, array) => {
      return index === array.findIndex(f => 
        f.name === facility.name && f.address === facility.address
      );
    });

    logger.info(`🎯 分类 ${categoryCode} 搜索完成，找到 ${uniqueFacilities.length} 个设施`);
    return uniqueFacilities;
  }

  /**
   * 导入指定分类的设施数据
   */
  async importCategoryFacilities(categoryCode, districts = SHANGHAI_DISTRICTS) {
    logger.info(`🏢 开始导入分类 ${categoryCode} 的设施数据`);

    try {
      const facilities = await this.searchFacilitiesFromAmap(categoryCode, districts);
      let imported = 0;

      if (facilities.length === 0) {
        logger.warn(`⚠️  分类 ${categoryCode} 未找到任何设施数据`);
        return 0;
      }

      logger.info(`📝 准备插入 ${facilities.length} 个设施到数据库...`);

      for (const facility of facilities) {
        try {
          await this.insertFacility(facility);
          imported++;
          
          // 每插入10个设施显示一次进度
          if (imported % 10 === 0) {
            logger.info(`💾 已插入 ${imported}/${facilities.length} 个设施...`);
          }
        } catch (error) {
          logger.error(`❌ 插入设施失败: ${facility.name}`, error);
        }
      }

      logger.info(`✅ 分类 ${categoryCode} 导入完成，成功导入 ${imported}/${facilities.length} 个设施`);
      return imported;
    } catch (error) {
      logger.error(`❌ 导入分类 ${categoryCode} 失败:`, error);
      return 0;
    }
  }

  /**
   * 获取统计信息
   */
  async getImportStats() {
    if (!this.connection) {
      throw new Error('数据库未连接');
    }

    const [facilityStats] = await this.connection.execute(`
      SELECT 
        fc.category_code,
        fc.category_name,
        COUNT(f.facility_id) as facility_count
      FROM facility_categories fc
      LEFT JOIN facilities f ON fc.category_code = f.category_code
      GROUP BY fc.category_code, fc.category_name
      HAVING COUNT(f.facility_id) > 0
      ORDER BY facility_count DESC, fc.category_code
    `);

    const [totalStats] = await this.connection.execute(`
      SELECT 
        COUNT(DISTINCT f.facility_id) as total_facilities,
        COUNT(DISTINCT f.location_id) as total_locations,
        COUNT(DISTINCT f.category_code) as categories_with_data
      FROM facilities f
    `);

    const totals = totalStats[0];
    
    logger.info('📈 设施导入统计（仅显示有数据的分类）:');
    console.table(facilityStats);
    
    logger.info(`📋 汇总统计:`);
    logger.info(`   🏢 设施总数: ${totals.total_facilities} 个`);
    logger.info(`   📍 位置总数: ${totals.total_locations} 个`);
    logger.info(`   📂 有数据分类: ${totals.categories_with_data} 个`);
  }
}

/**
 * 主导入程序
 */
async function main() {
  logger.info('🚀 开始上海市设施数据导入');
  
  // 验证配置
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    logger.error('配置验证失败:');
    configErrors.forEach(error => logger.error(`- ${error}`));
    process.exit(1);
  }

  const importer = new FacilityImporter();

  try {
    // 检查API密钥
    logger.info('检查高德API密钥...');
    const isApiValid = await importer.amapService.checkApiKey();
    if (!isApiValid) {
      throw new Error('高德API密钥无效，请检查配置');
    }
    logger.info('✅ 高德API密钥验证成功');

    // 连接数据库
    await importer.connect();

    // 检查现有数据状态
    logger.info('检查数据库现有数据状态...');
    const { facilityCount, locationCount } = await importer.checkDataStatus();
    
    logger.info(`当前数据状态: 设施${facilityCount}条, 位置${locationCount}条`);
    
    if (facilityCount > 0 || locationCount > 0) {
      logger.warn('⚠️  检测到现有数据，继续导入将自动跳过重复数据...\n');
    } else {
      logger.info('✅ 数据表为空，准备开始导入\n');
    }

    // 获取设施分类
    const categories = await importer.getFacilityCategories();
    logger.info(`📋 从数据库获取到 ${categories.length} 个设施分类`);

    // 过滤出有搜索关键词配置的分类
    const importableCategories = categories.filter(category => {
      const keywords = SEARCH_KEYWORDS[category.category_code];
      return keywords && keywords.length > 0;
    });
    
    logger.info(`🎯 其中 ${importableCategories.length} 个分类配置了搜索关键词，可进行导入`);
    
    if (importableCategories.length === 0) {
      logger.warn('⚠️  没有找到可导入的分类，请检查SEARCH_KEYWORDS配置');
      return;
    }

    // 显示导入计划
    logger.info('🗺️  导入覆盖范围:');
    logger.info(`   📍 行政区域: ${SHANGHAI_DISTRICTS.length} 个（${SHANGHAI_DISTRICTS.map(d => d.name).join('、')}）`);
    logger.info(`   🏢 设施分类: ${importableCategories.length} 个`);
    
    // 按优先级分组导入
    const priorityGroups = [
      { name: '高优先级区域（中心城区）', districts: SHANGHAI_DISTRICTS.filter(d => d.priority === 1) },
      { name: '中优先级区域（新城区）', districts: SHANGHAI_DISTRICTS.filter(d => d.priority === 2) },
      { name: '低优先级区域（远郊区）', districts: SHANGHAI_DISTRICTS.filter(d => d.priority === 3) }
    ];

    let totalImported = 0;
    const startTime = Date.now();

    for (let groupIndex = 0; groupIndex < priorityGroups.length; groupIndex++) {
      const group = priorityGroups[groupIndex];
      
      if (!group || group.districts.length === 0) continue;
      
      logger.info(`\n🎯 阶段 ${groupIndex + 1}: ${group.name}`);
      logger.info(`📊 覆盖区域: ${group.districts.map(d => d.name).join('、')} (${group.districts.length}个)`);
      
      // 只导入优先级分类，避免过度API调用
      const categoriesToImport = importableCategories.filter(cat => 
        PRIORITY_CATEGORIES.includes(cat.category_code)
      );
      
      logger.info(`🏢 导入分类: ${categoriesToImport.length} 个优先分类`);
      
      // 为每个分类在当前区域组中进行搜索
      for (let categoryIndex = 0; categoryIndex < categoriesToImport.length; categoryIndex++) {
        const category = categoriesToImport[categoryIndex];
        
        const progress = `${categoryIndex + 1}/${categoriesToImport.length}`;
        const overallProgress = `阶段${groupIndex + 1}/${priorityGroups.length}`;
        
        logger.info(`📈 ${overallProgress} 分类进度: ${progress} - 导入: ${category.category_name} (${category.category_code})`);
        
        try {
          const imported = await importer.importCategoryFacilities(
            category.category_code, 
            group.districts
          );
          totalImported += imported;
          
          // 显示进度统计
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          logger.info(`⏱️  已用时: ${elapsed}s | 累计导入: ${totalImported} 个`);
          
          // 分类间隔
          if ((categoryIndex + 1) % IMPORT_CONFIG.API_LIMITS.BATCH_SIZE === 0) {
            logger.info(`⏸️  暂停 ${IMPORT_CONFIG.API_LIMITS.BATCH_DELAY/1000} 秒避免API频率限制...`);
            await new Promise(resolve => setTimeout(resolve, IMPORT_CONFIG.API_LIMITS.BATCH_DELAY));
          }
        } catch (error) {
          logger.error(`❌ 分类 ${category.category_code} 在 ${group.name} 导入失败:`, error);
        }
      }
      
      logger.info(`✅ ${group.name} 导入完成`);
      
      // 阶段间统计
      if (groupIndex < priorityGroups.length - 1) {
        logger.info('\n📊 阶段导入统计:');
        await importer.getImportStats();
        
        // 阶段间间隔
        logger.info(`⏸️  阶段间暂停 ${IMPORT_CONFIG.API_LIMITS.BATCH_DELAY * 2/1000} 秒...`);
        await new Promise(resolve => setTimeout(resolve, IMPORT_CONFIG.API_LIMITS.BATCH_DELAY * 2));
      }
    }

    logger.info(`\n🎉 导入完成，总计导入 ${totalImported} 个设施`);

    // 输出最终统计信息
    logger.info('\n📊 最终导入统计:');
    await importer.getImportStats();

    logger.info('\n🎊 导入任务完成!');
    logger.info(`📈 导入成功: ${totalImported} 个设施`);
    logger.info(`🗺️  覆盖上海16个区域`);
    logger.info(`💾 locations 和 facilities 表已同步更新`);

  } catch (error) {
    logger.error('❌ 导入过程中发生错误:', error);
  } finally {
    await importer.disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    logger.error('程序执行失败:', error);
    process.exit(1);
  });
}

module.exports = { FacilityImporter, main };
