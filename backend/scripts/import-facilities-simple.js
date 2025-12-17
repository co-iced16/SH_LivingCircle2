/**
 * 简化版设施数据导入脚本
 * 使用高德地图POI搜索API获取设施数据
 * 
 * POI = Point of Interest (兴趣点)
 * 包括商店、餐厅、医院、学校等各类设施的地理位置信息
 * 
 * 核心思路：
 * 1. 读取数据库中的 facility_categories (设施分类)
 * 2. 清理分类名称（去掉前缀"xxx服务-"）作为搜索关键词
 * 3. 调用高德POI搜索API，在上海市搜索该类设施
 * 4. 解析API返回的POI数据（名称、地址、坐标）
 * 5. 去重后存入数据库 (locations + facilities 表)
 * 
 * 为什么使用POI搜索：
 * - 高德地图有完整的商业设施数据库
 * - 我们的数据库目前只有空的分类结构，缺少实际设施数据
 * - POI API可以根据关键词返回真实存在的设施位置信息
 */

const mysql = require('mysql2/promise');
const axios = require('axios');
const { IMPORT_MODES } = require('./import-modes');
const { mapAmapTypeToOurCategory, getValidCategoryCodes } = require('../utils/categoryMapping');
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

// 搜索配置
const SEARCH_CONFIG = {
  MAX_PAGES_PER_CATEGORY: 5,    // 每个分类最多搜索5页（250个POI）
  PAGE_SIZE: 50,                // 每页返回的POI数量
  REQUEST_DELAY: 500,           // 请求间隔（毫秒）
  API_TIMEOUT: 10000            // API超时时间（毫秒）
};

// 高德地图API配置
const AMAP_API_KEY = process.env.AMAP_API_KEY;
const AMAP_BASE_URL = 'https://restapi.amap.com/v3/place/text';

// 日志工具
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${new Date().toLocaleTimeString()} ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${new Date().toLocaleTimeString()} ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${new Date().toLocaleTimeString()} ${message}`, ...args)
};

/**
 * 简化版设施导入器
 */
class SimpleFacilityImporter {
  constructor() {
    this.connection = null;
    this.validCategoryCodes = null;
  }

  async connect() {
    this.connection = await mysql.createConnection(dbConfig);
    this.validCategoryCodes = await getValidCategoryCodes();
    logger.info('数据库连接成功');
    logger.info(`获取到 ${this.validCategoryCodes.size} 个有效分类代码`);
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      logger.info('数据库连接已关闭');
    }
  }

  /**
   * 获取所有子分类
   */
  async getAllCategories() {
    const [rows] = await this.connection.execute(`
      SELECT category_code, category_name, parent_code
      FROM facility_categories 
      WHERE parent_code IS NOT NULL
      ORDER BY category_code
    `);
    return rows;
  }

  /**
   * 清理分类名称，生成搜索关键词
   */
  getSearchKeyword(categoryName) {
    // 清理分类名称：移除前缀和后缀
    let keyword = categoryName
      .replace(/^.*?-/, '')          // 移除 "餐饮服务-" 这样的前缀
      .replace(/服务$/, '')          // 移除 "服务" 后缀
      .replace(/场所$/, '')          // 移除 "场所" 后缀
      .trim();

    return keyword;
  }

  /**
   * 高德POI搜索API - 支持分页获取更多数据，现在集成分类映射
   * 
   * POI (Point of Interest) = 兴趣点/设施点
   * 通过关键词搜索获取真实存在的设施数据，并智能映射分类
   * 
   * 例如：搜索"便利店" → 分页获取上海市所有便利店的名称、地址、坐标、分类代码
   */
  async searchPOI(keyword, city = '上海', maxPages = 5) {
    const allPois = [];
    
    try {
      logger.info(`🔍 POI分页搜索: ${keyword} (城市: ${city})`);
      
      // 分页获取数据，每页最多50个，最多获取指定页数
      for (let page = 1; page <= maxPages; page++) {
        const params = {
          key: AMAP_API_KEY,
          keywords: keyword,       // 搜索关键词，如"便利店"、"医院"
          city: city,             // 搜索城市
          output: 'json',         // 返回JSON格式
          page: page,             // 页码（从1开始）
          offset: 50,             // 每页最多50个POI点
          extensions: 'all'       // 获取完整信息，包括typecode
        };

        logger.info(`   正在获取第 ${page} 页...`);
        
        const response = await axios.get(AMAP_BASE_URL, {
          params,
          timeout: 10000
        });

        if (response.data.status !== '1') {
          logger.error(`POI搜索API请求失败: ${response.data.info}`);
          break;
        }

        const pois = response.data.pois || [];
        logger.info(`   📍 第 ${page} 页找到 ${pois.length} 个POI点`);

        // 如果这一页没有数据，说明已经到最后了
        if (pois.length === 0) {
          logger.info(`   ✅ 已获取所有数据，共 ${page - 1} 页`);
          break;
        }

        // 解析POI数据：提取名称、地址、坐标等信息，并进行分类映射
        for (const poi of pois) {
          try {
            // 基本数据提取
            const basicPoi = {
              name: poi.name,                                           
              address: poi.address,                                     
              longitude: parseFloat(poi.location?.split(',')[0] || 0),  
              latitude: parseFloat(poi.location?.split(',')[1] || 0),   
              adcode: poi.adcode,
              original_typecode: poi.typecode || null
            };
            
            // 基本过滤：坐标、地址检查
            const hasCoords = basicPoi.longitude && basicPoi.latitude;
            const hasAddress = basicPoi.address;
            
            if (!hasCoords) {
              logger.info(`   ❌ 跳过无坐标: ${basicPoi.name}`);
              continue;
            }
            if (!hasAddress) {
              logger.info(`   ❌ 跳过无地址: ${basicPoi.name}`);
              continue;
            }
            
            // 分类映射：如果有typecode，尝试映射到我们的分类系统
            let mappedCategoryCode = null;
            if (basicPoi.original_typecode) {
              mappedCategoryCode = await mapAmapTypeToOurCategory(
                basicPoi.original_typecode, 
                this.validCategoryCodes
              );
              
              // 只在第一页记录映射详情，避免日志过多
              if (page === 1 && mappedCategoryCode && mappedCategoryCode !== basicPoi.original_typecode) {
                logger.info(`   🎯 分类映射: ${basicPoi.original_typecode} -> ${mappedCategoryCode} (${basicPoi.name})`);
              }
            }
            
            // 添加映射后的分类代码
            basicPoi.mapped_category_code = mappedCategoryCode;
            
            // 只在第一页显示详细信息，避免日志过多
            if (page === 1) {  
              logger.info(`   ✅ 有效POI: ${basicPoi.name} - ${basicPoi.address}`);
            }
            
            allPois.push(basicPoi);
            
          } catch (error) {
            logger.error(`处理POI失败: ${poi.name}`, error);
          }
        }

        // 如果返回的POI数量少于50，说明已经是最后一页了
        if (pois.length < 50) {
          logger.info(`   ✅ 已获取所有数据，最后一页只有 ${pois.length} 个POI`);
          break;
        }

        // API限流：页面间隔500ms
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info(`   🎯 总共获取到 ${allPois.length} 个有效POI点`);
      
      // 统计分类映射结果
      const mappedCount = allPois.filter(poi => poi.mapped_category_code).length;
      const unmappedCount = allPois.length - mappedCount;
      logger.info(`   📊 分类映射统计: ${mappedCount} 个已映射, ${unmappedCount} 个未映射`);
      
      return allPois;

    } catch (error) {
      logger.error(`POI搜索失败 [${keyword}]:`, error.message);
      return allPois;
    }
  }

  /**
   * 提取行政区划代码
   */
  extractDistrictCode(address) {
    const districtMap = {
      '黄浦区': '310101', '徐汇区': '310104', '长宁区': '310105', '静安区': '310106',
      '普陀区': '310107', '虹口区': '310109', '杨浦区': '310110', '浦东新区': '310115',
      '闵行区': '310112', '宝山区': '310113', '嘉定区': '310114', '松江区': '310117',
      '青浦区': '310118', '奉贤区': '310120', '金山区': '310116', '崇明区': '310151'
    };

    for (const [district, code] of Object.entries(districtMap)) {
      if (address.includes(district)) {
        return code;
      }
    }
    return null;
  }

  /**
   * 插入位置数据
   */
  async insertLocation(address, longitude, latitude, districtCode) {
    // 检查是否已存在相同地址
    const [existing] = await this.connection.execute(
      'SELECT location_id FROM locations WHERE formatted_address = ?',
      [address]
    );

    if (existing.length > 0) {
      return existing[0].location_id;
    }

    // 插入新位置
    const [result] = await this.connection.execute(
      'INSERT INTO locations (formatted_address, longitude, latitude, district_code) VALUES (?, ?, ?, ?)',
      [address, longitude, latitude, districtCode]
    );

    return result.insertId;
  }

  /**
   * 导入单个分类的设施 - 现在支持智能分类映射
   */
  async importCategory(category, importMode = null) {
    const { category_code, category_name } = category;
    logger.info(`🏢 导入分类: ${category_code} - ${category_name}`);

    // 生成搜索关键词
    const keyword = this.getSearchKeyword(category_name);
    logger.info(`🎯 搜索关键词: "${keyword}"`);

    // 确定搜索页数
    const maxPages = importMode?.MAX_PAGES || 5;

    // 搜索POI
    const pois = await this.searchPOI(keyword, '上海', maxPages);
    
    if (pois.length === 0) {
      logger.warn(`❌ 分类 ${category_code} 未找到任何设施`);
      return 0;
    }

    // 去重：基于名称和地址
    const uniquePois = pois.filter((poi, index, array) => {
      return index === array.findIndex(p => 
        p.name === poi.name && p.address === poi.address
      );
    });

    logger.info(`📝 去重后剩余 ${uniquePois.length} 个设施`);

    // 分类POI：已映射的和未映射的
    const mappedPois = uniquePois.filter(poi => poi.mapped_category_code);
    const unmappedPois = uniquePois.filter(poi => !poi.mapped_category_code);
    
    logger.info(`📊 分类策略: ${mappedPois.length} 个智能映射到现有分类, ${unmappedPois.length} 个使用默认分类 ${category_code}`);

    // 导入数据库
    let imported = 0;
    let skipped = 0;
    
    // 处理所有POI，智能选择分类
    for (const poi of uniquePois) {
      try {
        // 优先使用智能映射的分类，否则使用默认分类
        const finalCategoryCode = poi.mapped_category_code || category_code;
        
        const result = await this.insertFacility(poi, finalCategoryCode);
        if (result.success) {
          imported++;
          if (poi.mapped_category_code) {
            logger.info(`   ✅ 新增设施(智能映射): ${poi.name} -> ${finalCategoryCode}`);
          } else {
            logger.info(`   ✅ 新增设施(默认分类): ${poi.name} -> ${finalCategoryCode}`);
          }
        } else {
          skipped++;
          logger.info(`   ⏭️ 已存在设施: ${poi.name}`);
        }
      } catch (error) {
        logger.error(`插入设施失败: ${poi.name}`, error);
        skipped++;
      }
    }

    logger.info(`✅ 分类 ${category_code} 导入完成，成功导入 ${imported}/${uniquePois.length} 个设施 (跳过${skipped}个重复)\n`);
    return imported;
  }
  
  /**
   * 插入单个设施的辅助方法
   */
  async insertFacility(poi, categoryCode) {
    const districtCode = this.extractDistrictCode(poi.address);
    const locationId = await this.insertLocation(
      poi.address, 
      poi.longitude, 
      poi.latitude, 
      districtCode
    );

    // 检查设施是否已存在
    const [existingFacility] = await this.connection.execute(
      'SELECT facility_id FROM facilities WHERE name = ? AND location_id = ? AND category_code = ?',
      [poi.name, locationId, categoryCode]
    );

    if (existingFacility.length === 0) {
      // 插入设施，直接使用映射后的分类代码
      await this.connection.execute(
        'INSERT INTO facilities (name, location_id, category_code) VALUES (?, ?, ?)',
        [poi.name, locationId, categoryCode]
      );
      return { success: true };
    } else {
      return { success: false };
    }
  }

  /**
   * 获取导入统计
   */
  async getStats() {
    const [stats] = await this.connection.execute(`
      SELECT 
        COUNT(DISTINCT f.facility_id) as total_facilities,
        COUNT(DISTINCT f.location_id) as total_locations,
        COUNT(DISTINCT f.category_code) as categories_with_data
      FROM facilities f
    `);

    const [topCategories] = await this.connection.execute(`
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

    const total = stats[0];
    logger.info('\n📊 导入统计:');
    logger.info(`   🏢 设施总数: ${total.total_facilities} 个`);
    logger.info(`   📍 位置总数: ${total.total_locations} 个`);
    logger.info(`   📂 有数据分类: ${total.categories_with_data} 个`);
    
    logger.info('\n📈 设施数量最多的前10个分类:');
    console.table(topCategories);
  }
}

/**
 * 主程序 - 支持不同导入模式
 */
async function main() {
  if (!AMAP_API_KEY) {
    logger.error('❌ 请设置高德API密钥环境变量 AMAP_API_KEY');
    process.exit(1);
  }

  // 获取导入模式参数
  const args = process.argv.slice(2);
  const modeArg = args[0] || 'STANDARD';
  const mode = IMPORT_MODES[modeArg.toUpperCase()] || IMPORT_MODES.STANDARD;

  logger.info(`🚀 开始设施数据导入`);
  logger.info(`📋 导入模式: ${modeArg.toUpperCase()} - ${mode.DESCRIPTION}`);
  logger.info(`📄 每分类最多获取: ${mode.MAX_PAGES} 页 (${mode.MAX_PAGES * SEARCH_CONFIG.PAGE_SIZE} 个POI)`);

  // 更新搜索配置
  SEARCH_CONFIG.MAX_PAGES_PER_CATEGORY = mode.MAX_PAGES;

  const importer = new SimpleFacilityImporter();
  
  try {
    await importer.connect();

    // 获取所有分类
    const categories = await importer.getAllCategories();
    logger.info(`📋 从数据库获取到 ${categories.length} 个设施分类`);

    // 估算总体数据量
    const estimatedTotal = categories.length * mode.MAX_PAGES * SEARCH_CONFIG.PAGE_SIZE;
    logger.info(`📊 预估最大数据量: ${estimatedTotal} 个POI`);

    // 逐个导入分类
    let totalImported = 0;
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      logger.info(`\n🔄 进度: ${i + 1}/${categories.length}`);
      
      const imported = await importer.importCategory(category, mode);
      totalImported += imported;
      
      // API限流：分类间隔
      await new Promise(resolve => setTimeout(resolve, SEARCH_CONFIG.REQUEST_DELAY));
    }

    // 显示最终统计
    logger.info(`\n🎉 导入完成！总共导入 ${totalImported} 个设施`);
    await importer.getStats();

  } catch (error) {
    logger.error('❌ 导入失败:', error);
  } finally {
    await importer.disconnect();
  }

  // 显示使用说明
  logger.info('\n💡 使用说明:');
  Object.entries(IMPORT_MODES).forEach(([key, value]) => {
    logger.info(`   node import-facilities-simple.js ${key.toLowerCase()} - ${value.DESCRIPTION}`);
  });
}

// 运行主程序
if (require.main === module) {
  main().catch(error => {
    logger.error('程序执行失败:', error);
    process.exit(1);
  });
}

module.exports = { SimpleFacilityImporter };
