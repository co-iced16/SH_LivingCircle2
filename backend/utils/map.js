const axios = require('axios');
const { mapAmapTypeToOurCategory, getValidCategoryCodes } = require('./categoryMapping');

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
    // 获取所有有效的分类代码
    const validCategoryCodes = await getValidCategoryCodes();
    
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
      
      // 过滤和映射POI：只保留能映射到我们分类体系的设施
      const processedPois = [];
      
      for (const poi of pois) {
        // 检查是否为上海市
        if (poi.cityname !== '上海市' && poi.cityname !== '上海') {
          console.log(`过滤掉非上海市设施: ${poi.name} (${poi.cityname})`);
          continue;
        }
        
        // 尝试映射分类代码
        const mappedCategory = await mapAmapTypeToOurCategory(poi.typecode, validCategoryCodes);
        
        if (mappedCategory) {
          console.log(`映射成功: ${poi.typecode} -> ${mappedCategory} (${poi.name})`);
          
          const [lng, lat] = poi.location.split(',').map(Number);
          processedPois.push({
            id: poi.id,
            name: poi.name,
            type: poi.type,
            typecode: mappedCategory, // 使用映射后的分类代码
            original_typecode: poi.typecode, // 保留原始分类代码用于调试
            address: poi.address,
            longitude: lng,
            latitude: lat,
            tel: poi.tel,
            business_area: poi.business_area
          });
        } else {
          console.log(`过滤掉无法映射的分类 ${poi.typecode}: ${poi.name}`);
        }
      }
      
      console.log(`过滤和映射后结果: ${processedPois.length} 个POI`);
      
      return {
        success: true,
        total: processedPois.length, // 使用处理后的数量
        page: page,
        limit: limit,
        facilities: processedPois
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
/**
 * 搜索附近的POI设施（用于评估模块补充搜索）
 * @param {number} longitude 中心点经度
 * @param {number} latitude 中心点纬度
 * @param {string} keyword 搜索关键词
 * @param {number} radius 搜索半径（米）
 * @returns {Promise<Array>} POI列表
 */
const searchNearbyPOI = async (longitude, latitude, keyword, radius = 1000) => {
  try {
    const response = await amapApi.get('/v3/place/around', {
      params: {
        location: `${longitude},${latitude}`,
        keywords: keyword,
        radius: Math.min(radius, 50000), // API最大支持50km
        output: 'json',
        extensions: 'all'
      }
    });

    if (response.data.status === '1' && response.data.pois) {
      return response.data.pois
        .filter(poi => {
          // 过滤上海市内的设施
          return poi.cityname === '上海市' || poi.cityname === '上海';
        })
        .map(poi => {
          const [lng, lat] = poi.location.split(',').map(Number);
          return {
            name: poi.name,
            address: poi.address,
            longitude: lng,
            latitude: lat,
            typecode: poi.typecode || null,
            distance: calculateDistance(longitude, latitude, lng, lat)
          };
        })
        .filter(poi => poi.distance <= radius) // 确保在指定半径内
        .sort((a, b) => a.distance - b.distance) // 按距离排序
        .slice(0, 20); // 最多返回20个
    } else {
      console.log('高德POI搜索无结果:', response.data.info || '未知错误');
      return [];
    }
  } catch (error) {
    console.error('高德POI搜索失败:', error.message);
    return [];
  }
};

/**
 * 计算两点之间的距离
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

/**
 * 获取路径信息（调用高德地图路径规划API）
 * @param {number} originLng 起点经度
 * @param {number} originLat 起点纬度
 * @param {number} destLng 终点经度
 * @param {number} destLat 终点纬度
 * @param {string} mode 交通方式：walking(步行)、transit(公交)、driving(驾车)、bicycling(骑行)
 * @returns {Promise<Object>} 路径信息
 */
const getRouteInfo = async (originLng, originLat, destLng, destLat, mode = 'walking') => {
  try {
    // 高德地图路径规划API映射
    const modeMapping = {
      walk: 'walking',
      bus: 'transit', 
      car: 'driving',
      ride: 'bicycling'
    };
    
    const amapMode = modeMapping[mode] || mode;
    let endpoint;
    
    // 根据交通方式选择不同的API端点
    switch (amapMode) {
      case 'walking':
        endpoint = '/v3/direction/walking';
        break;
      case 'transit':
        endpoint = '/v3/direction/transit/integrated'; // 修复公交API端点
        break;
      case 'driving':
        endpoint = '/v3/direction/driving';
        break;
      case 'bicycling':
        endpoint = '/v3/direction/bicycling'; // 修复骑行API端点
        break;
      default:
        endpoint = '/v3/direction/walking';
    }

    const response = await amapApi.get(endpoint, {
      params: {
        origin: `${originLng},${originLat}`,
        destination: `${destLng},${destLat}`,
        city: '上海',
        cityd: '上海'
      }
    });

    if (response.data.status === '1') {
      let duration = 0;
      let distance = 0;

      if (amapMode === 'walking' && response.data.route?.paths?.[0]) {
        const path = response.data.route.paths[0];
        duration = parseInt(path.duration) || 0; // 秒
        distance = parseInt(path.distance) || 0; // 米
      } else if (amapMode === 'driving' && response.data.route?.paths?.[0]) {
        const path = response.data.route.paths[0];
        duration = parseInt(path.duration) || 0; // 秒
        distance = parseInt(path.distance) || 0; // 米
      } else if (amapMode === 'transit' && response.data.route?.transits?.[0]) {
        const transit = response.data.route.transits[0];
        duration = parseInt(transit.duration) || 0; // 秒
        distance = parseInt(transit.distance) || 0; // 米
      } else if (amapMode === 'bicycling' && response.data.route?.paths?.[0]) {
        const path = response.data.route.paths[0];
        duration = parseInt(path.duration) || 0; // 秒
        distance = parseInt(path.distance) || 0; // 米
      }

      // 如果公交API返回成功但数据为空或时间为0，降级到估算
      if (amapMode === 'transit' && (duration === 0 || !response.data.route?.transits?.[0])) {
        console.log(`公交路径规划数据为空或时间为0，降级到估算`);
        return getSimpleRouteEstimate(originLng, originLat, destLng, destLat, mode);
      }

      // 如果其他方式的时间为0，也降级到估算（可能是API数据异常）
      if (duration === 0 && distance > 0) {
        console.log(`路径规划API返回时间为0但距离>0，降级到估算 (${mode})`);
        return getSimpleRouteEstimate(originLng, originLat, destLng, destLat, mode);
      }

      return {
        success: true,
        duration: Math.round(duration / 60), // 转换为分钟
        distance: distance,
        mode: mode
      };
    } else {
      // 检查是否是API配额限制或其他特定错误
      const errorCode = response.data.infocode;
      if (errorCode === '10044' || response.data.info?.includes('EXCEEDED_THE_LIMIT')) {
        console.log(`路径规划API配额限制 (${mode}), 降级到估算`);
      } else {
        console.log(`路径规划API失败 (${mode}):`, response.data.info || '未知错误');
      }
      // 降级到简单估算
      return getSimpleRouteEstimate(originLng, originLat, destLng, destLat, mode);
    }
  } catch (error) {
    console.error(`路径规划API调用失败 (${mode}):`, error.message);
    // 降级到简单估算
    return getSimpleRouteEstimate(originLng, originLat, destLng, destLat, mode);
  }
};

/**
 * 简单路径估算（备用方案）
 */
const getSimpleRouteEstimate = (originLng, originLat, destLng, destLat, mode) => {
  const distance = calculateDistance(originLng, originLat, destLng, destLat);
  
  let duration; // 分钟
  switch (mode) {
    case 'walk':
      duration = Math.max(1, Math.round(distance / 80)); // 步行速度约80m/min，最少1分钟
      break;
    case 'bus':
      // 公交需要考虑等车时间，所以即使距离很近也要至少1-2分钟
      duration = Math.max(1, Math.round(distance / 250)); // 公交平均速度约250m/min，最少1分钟
      break;
    case 'car':
      duration = Math.max(1, Math.round(distance / 400)); // 汽车平均速度约400m/min，最少1分钟
      break;
    case 'ride':
      duration = Math.max(1, Math.round(distance / 300)); // 骑行平均速度约300m/min，最少1分钟
      break;
    default:
      duration = Math.max(1, Math.round(distance / 80));
  }

  return {
    success: true,
    duration: duration,
    distance: distance,
    mode: mode,
    estimated: true // 标记为估算值
  };
};

module.exports = {
  geocode,
  reverseGeocode,
  searchPOI,
  searchFacilitiesByCategory,
  calculateDistance,
  searchPOIByText,
  searchNearbyPOI,
  getRouteInfo
};
