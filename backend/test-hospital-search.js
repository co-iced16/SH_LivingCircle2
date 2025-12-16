const http = require('http');

function testHospitalSearch() {
  const keywords = encodeURIComponent('医院');
  const city = encodeURIComponent('上海');
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/facilities/map-search?keywords=${keywords}&city=${city}&limit=10`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        
        if (jsonData.success && jsonData.data && jsonData.data.facilities) {
          console.log(`✅ 找到 ${jsonData.data.facilities.length} 个医院设施`);
          console.log(`总数: ${jsonData.data.pagination.total}`);
          
          // 显示前几个结果
          jsonData.data.facilities.slice(0, 5).forEach((facility, index) => {
            console.log(`${index + 1}. ${facility.name} (分类: ${facility.typecode})`);
            console.log(`   地址: ${facility.address}`);
          });
          
          // 统计分类代码
          const categoryCounts = {};
          jsonData.data.facilities.forEach(facility => {
            categoryCounts[facility.typecode] = (categoryCounts[facility.typecode] || 0) + 1;
          });
          
          console.log('\n分类统计:');
          Object.entries(categoryCounts).forEach(([code, count]) => {
            console.log(`  ${code}: ${count}个`);
          });
          
        } else {
          console.log('❌ 搜索失败:', jsonData.message);
        }
      } catch (error) {
        console.log('❌ 无法解析JSON响应:', error.message);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求错误:', error.message);
  });

  req.end();
}

console.log('🏥 测试医院搜索...');
testHospitalSearch();
