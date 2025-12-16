const { reverseGeocode } = require('../utils/map');

// 测试高德地图API反编码功能
async function testReverseGeocode() {
  console.log('🧪 测试高德地图API反编码功能...\n');

  // 测试坐标（上海市中心）
  const testCoordinates = [
    { lng: 121.473701, lat: 31.230416, desc: '上海市中心（人民广场）' },
    { lng: 121.505, lat: 31.245, desc: '上海外滩' },
    { lng: 121.445, lat: 31.213, desc: '上海徐家汇' }
  ];

  for (const coord of testCoordinates) {
    try {
      console.log(`📍 测试位置: ${coord.desc}`);
      console.log(`   坐标: ${coord.lng}, ${coord.lat}`);
      
      const result = await reverseGeocode(coord.lng, coord.lat);
      
      if (result.success) {
        console.log('✅ 反编码成功:');
        console.log(`   详细地址: ${result.formatted_address}`);
        console.log(`   省份: ${result.province}`);
        console.log(`   城市: ${result.city}`);
        console.log(`   区域: ${result.district}`);
        console.log(`   街道: ${result.township}`);
        
        if (result.neighborhood) {
          console.log(`   社区: ${result.neighborhood}`);
        }
        
        if (result.building) {
          console.log(`   建筑: ${result.building}`);
        }
        
        if (result.street) {
          console.log(`   道路: ${result.street} ${result.streetNumber || ''}`);
        }
        
        if (result.businessAreas && result.businessAreas.length > 0) {
          console.log(`   商圈: ${result.businessAreas.join(', ')}`);
        }
        
        if (result.pois && result.pois.length > 0) {
          console.log('   附近POI:');
          result.pois.slice(0, 3).forEach(poi => {
            console.log(`     - ${poi.name} (${poi.distance}m)`);
          });
        }
      } else {
        console.log('❌ 反编码失败:', result.message);
      }
      
    } catch (error) {
      console.log('❌ API调用失败:', error.message);
    }
    
    console.log(''); // 空行分隔
  }
  
  console.log('🎉 测试完成！');
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  testReverseGeocode();
}

module.exports = testReverseGeocode;
