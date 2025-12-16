const axios = require('axios');

// 高德地图API配置
const AMAP_BASE_URL = process.env.AMAP_BASE_URL || 'https://restapi.amap.com';
const AMAP_API_KEY = process.env.AMAP_API_KEY;

// 创建axios实例
const amapApi = axios.create({
  baseURL: AMAP_BASE_URL,
  timeout: 10000,
  params: {
    key: AMAP_API_KEY
  }
});

/**
 * 地理编码 - 将地址转换为坐标
 * @param {string} address 地址
 * @returns {Promise<Object>} 坐标信息
 */
const geocode = async (address) => {
  try {
    const response = await amapApi.get('/v3/geocode/geo', {
      params: {
        address: address,
        city: '上海'
      }
    });

    if (response.data.status === '1' && response.data.geocodes.length > 0) {
      const location = response.data.geocodes[0];
      const [lng, lat] = location.location.split(',').map(Number);
      
      return {
        success: true,
        longitude: lng,
        latitude: lat,
        formatted_address: location.formatted_address,
        district: location.district,
        township: location.township
      };
    } else {
      return {
        success: false,
        message: '地址解析失败'
      };
    }
  } catch (error) {
    console.error('地理编码错误:', error.message);
    return {
      success: false,
      message: '地理编码服务异常'
    };
  }
};

/**
 * 逆地理编码 - 将坐标转换为地址
 * @param {number} longitude 经度
 * @param {number} latitude 纬度
 * @returns {Promise<Object>} 地址信息
 */
const reverseGeocode = async (longitude, latitude) => {
  try {
    const response = await amapApi.get('/v3/geocode/regeo', {
      params: {
        location: `${longitude},${latitude}`,
        radius: 1000,
        extensions: 'all'  // 获取更详细的信息
      }
    });

    if (response.data.status === '1' && response.data.regeocode) {
      const regeocode = response.data.regeocode;
      const addressComponent = regeocode.addressComponent;
      
      return {
        success: true,
        formatted_address: regeocode.formatted_address,
        // 行政区信息
        province: addressComponent.province || '',
        city: addressComponent.city || '',
        district: addressComponent.district || '',
        township: addressComponent.township || '',
        neighborhood: addressComponent.neighborhood?.name || '',
        building: addressComponent.building?.name || '',
        // 道路信息
        street: addressComponent.streetNumber?.street || '',
        streetNumber: addressComponent.streetNumber?.number || '',
        // POI信息
        businessAreas: regeocode.aois?.map(aoi => aoi.name) || [],
        pois: regeocode.pois?.slice(0, 5).map(poi => ({
          name: poi.name,
          type: poi.type,
          distance: poi.distance
        })) || []
      };
    } else {
      return {
        success: false,
        message: '坐标解析失败'
      };
    }
  } catch (error) {
    console.error('逆地理编码错误:', error.message);
    return {
      success: false,
      message: '逆地理编码服务异常'
    };
  }
};

/**
 * POI搜索 - 搜索周边设施
 * @param {number} longitude 经度
 * @param {number} latitude 纬度
 * @param {string} types 设施类型
 * @param {number} radius 搜索半径（米）
 * @param {number} page 页码
 * @param {number} limit 每页数量
 * @returns {Promise<Object>} 搜索结果
 */
const searchPOI = async (longitude, latitude, types = '', radius = 1000, page = 1, limit = 20) => {
  try {
    const response = await amapApi.get('/v3/place/around', {
      params: {
        location: `${longitude},${latitude}`,
        types: types,
        radius: radius,
        page: page,
        offset: limit,
        extensions: 'all'
      }
    });

    if (response.data.status === '1') {
      const pois = response.data.pois || [];
      
      return {
        success: true,
        total: parseInt(response.data.count) || 0,
        page: page,
        limit: limit,
        facilities: pois.map(poi => {
          const [lng, lat] = poi.location.split(',').map(Number);
          return {
            id: poi.id,
            name: poi.name,
            type: poi.type,
            typecode: poi.typecode,
            address: poi.address,
            longitude: lng,
            latitude: lat,
            distance: parseInt(poi.distance) || 0,
            tel: poi.tel,
            business_area: poi.business_area
          };
        })
      };
    } else {
      return {
        success: false,
        message: 'POI搜索失败'
      };
    }
  } catch (error) {
    console.error('POI搜索错误:', error.message);
    return {
      success: false,
      message: 'POI搜索服务异常'
    };
  }
};

/**
 * 搜索特定类型的设施
 * @param {number} longitude 经度
 * @param {number} latitude 纬度
 * @param {number} radius 搜索半径
 * @returns {Promise<Object>} 分类设施统计
 */
const searchFacilitiesByCategory = async (longitude, latitude, radius = 1000) => {
  const categoryMapping = {
    education: '141200|141201|141202',  // 学校、幼儿园、培训机构
    healthcare: '090100|090200|090300', // 医院、诊所、药店
    shopping: '060100|060200|060300|060400', // 购物中心、超市、便利店
    transport: '150100|150200|150300|150400|150500' // 地铁、公交、停车场
  };

  const results = {};

  try {
    for (const [category, types] of Object.entries(categoryMapping)) {
      const searchResult = await searchPOI(longitude, latitude, types, radius, 1, 50);
      
      if (searchResult.success) {
        results[category] = {
          count: searchResult.total,
          facilities: searchResult.facilities.slice(0, 10), // 只返回前10个
          avg_distance: searchResult.facilities.length > 0 
            ? Math.round(searchResult.facilities.reduce((sum, f) => sum + f.distance, 0) / searchResult.facilities.length)
            : 0
        };
      } else {
        results[category] = {
          count: 0,
          facilities: [],
          avg_distance: 0
        };
      }
    }

    return {
      success: true,
      data: results
    };
  } catch (error) {
    console.error('分类设施搜索错误:', error.message);
    return {
      success: false,
      message: '设施搜索服务异常'
    };
  }
};

/**
 * 文本搜索POI
 * @param {string} keywords 搜索关键词
 * @param {string} city 城市名称
 * @param {number} page 页码
 * @param {number} limit 每页数量
 * @returns {Promise<Object>} 搜索结果
 */
const searchPOIByText = async (keywords, city = '上海', page = 1, limit = 20) => {
  try {
    // 首先获取所有有效的分类代码
    const { pool } = require('../config/database');
    const [validCategories] = await pool.execute('SELECT category_code FROM facility_categories');
    const validCategoryCodes = new Set(validCategories.map(cat => cat.category_code));
    
    console.log(`高德搜索开始 - 关键词: ${keywords}, 城市: ${city}, 有效分类数: ${validCategoryCodes.size}`);
    
    const response = await amapApi.get('/v3/place/text', {
      params: {
        keywords: keywords,
        city: city,
        page: page,
        offset: limit,
        extensions: 'all'
      }
    });

    if (response.data.status === '1') {
      const pois = response.data.pois || [];
      console.log(`高德原始结果: ${pois.length} 个POI`);
      
      // 过滤POI：只保留有效分类和上海市的设施
      const filteredPois = pois.filter(poi => {
        // 检查分类代码是否有效
        if (!validCategoryCodes.has(poi.typecode)) {
          console.log(`过滤掉无效分类 ${poi.typecode}: ${poi.name}`);
          return false;
        }
        
        // 检查是否为上海市
        if (poi.cityname !== '上海市' && poi.cityname !== '上海') {
          console.log(`过滤掉非上海市设施: ${poi.name} (${poi.cityname})`);
          return false;
        }
        
        return true;
      });
      
      console.log(`过滤后结果: ${filteredPois.length} 个POI`);
      
      return {
        success: true,
        total: filteredPois.length, // 使用过滤后的数量
        page: page,
        limit: limit,
        facilities: filteredPois.map(poi => {
          const [lng, lat] = poi.location.split(',').map(Number);
          return {
            id: poi.id,
            name: poi.name,
            type: poi.type,
            typecode: poi.typecode,
            address: poi.address,
            longitude: lng,
            latitude: lat,
            tel: poi.tel,
            business_area: poi.business_area
          };
        })
      };
    } else {
      return {
        success: false,
        message: 'POI搜索失败'
      };
    }
  } catch (error) {
    console.error('POI文本搜索错误:', error.message);
    return {
      success: false,
      message: 'POI搜索服务异常'
    };
  }
};

/**
 * 计算两点间距离（米）
 * @param {number} lng1 经度1
 * @param {number} lat1 纬度1
 * @param {number} lng2 经度2
 * @param {number} lat2 纬度2
 * @returns {number} 距离（米）
 */
const calculateDistance = (lng1, lat1, lng2, lat2) => {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

module.exports = {
  geocode,
  reverseGeocode,
  searchPOI,
  searchFacilitiesByCategory,
  calculateDistance,
  searchPOIByText
};
