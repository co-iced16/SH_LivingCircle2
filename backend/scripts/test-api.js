const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';

// 测试数据
const testLocation = {
  longitude: 121.473701,
  latitude: 31.230416,
  formatted_address: '上海市黄浦区人民广场',
  district_code: '310101'
};

async function testLocationAPI() {
  console.log('🚀 测试位置相关API功能...\n');

  try {
    // 1. 测试保存位置信息
    console.log('1️⃣ 测试保存位置信息...');
    const saveResponse = await axios.post(`${API_BASE}/map/location`, testLocation);
    
    if (saveResponse.data.success) {
      console.log('✅ 位置信息保存成功');
      console.log('   返回数据:', saveResponse.data.data);
      
      const locationId = saveResponse.data.data.location_id;
      
      // 2. 测试根据ID获取位置信息
      console.log('\n2️⃣ 测试获取位置信息...');
      const getResponse = await axios.get(`${API_BASE}/map/location/${locationId}`);
      
      if (getResponse.data.success) {
        console.log('✅ 位置信息获取成功');
        console.log('   位置数据:', getResponse.data.data);
      } else {
        console.log('❌ 获取位置信息失败:', getResponse.data.message);
      }
      
    } else {
      console.log('❌ 保存位置信息失败:', saveResponse.data.message);
    }
    
    // 3. 测试反编码API
    console.log('\n3️⃣ 测试高德地图反编码API...');
    const geocodeResponse = await axios.get(`${API_BASE}/map/reverse-geocode`, {
      params: {
        longitude: testLocation.longitude,
        latitude: testLocation.latitude
      }
    });
    
    if (geocodeResponse.data.success) {
      console.log('✅ 反编码成功');
      console.log('   详细地址:', geocodeResponse.data.data.formatted_address);
      console.log('   行政区信息:', {
        province: geocodeResponse.data.data.province,
        city: geocodeResponse.data.data.city,
        district: geocodeResponse.data.data.district,
        township: geocodeResponse.data.data.township
      });
    } else {
      console.log('❌ 反编码失败:', geocodeResponse.data.message);
    }
    
    // 4. 测试根据坐标查找位置
    console.log('\n4️⃣ 测试根据坐标查找位置...');
    const findResponse = await axios.get(`${API_BASE}/map/location/find/coords`, {
      params: {
        longitude: testLocation.longitude,
        latitude: testLocation.latitude
      }
    });
    
    if (findResponse.data.success) {
      console.log('✅ 坐标查找成功');
      if (findResponse.data.data) {
        console.log('   找到匹配位置:', findResponse.data.data.formatted_address);
      } else {
        console.log('   未找到匹配位置');
      }
    } else {
      console.log('❌ 坐标查找失败:', findResponse.data.message);
    }
    
    // 5. 测试服务器健康检查
    console.log('\n5️⃣ 测试服务器健康状态...');
    const healthResponse = await axios.get(`http://localhost:3000/health`);
    
    if (healthResponse.data.success) {
      console.log('✅ 服务器运行正常');
      console.log('   状态:', healthResponse.data.message);
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API请求失败:', error.response.data);
    } else if (error.request) {
      console.log('❌ 网络连接失败，请确保后端服务器已启动 (http://localhost:3000)');
    } else {
      console.log('❌ 测试错误:', error.message);
    }
  }
  
  console.log('\n🎉 API测试完成！');
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  testLocationAPI();
}

module.exports = testLocationAPI;
