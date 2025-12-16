const http = require('http');

function testMapSearch() {
  const keywords = encodeURIComponent('同济大学');
  const city = encodeURIComponent('上海');
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/facilities/map-search?keywords=${keywords}&city=${city}&limit=5`,
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
        console.log('地图搜索API响应:');
        console.log(JSON.stringify(jsonData, null, 2));
        
        if (jsonData.success && jsonData.data && jsonData.data.facilities) {
          console.log('\n✅ 地图搜索API测试成功！');
          console.log(`找到 ${jsonData.data.facilities.length} 个设施`);
          jsonData.data.facilities.forEach((facility, index) => {
            console.log(`${index + 1}. ${facility.name} (分类: ${facility.typecode})`);
            console.log(`   地址: ${facility.address}`);
          });
        } else {
          console.log('\n❌ 地图搜索失败:', jsonData.message);
        }
      } catch (error) {
        console.log('\n❌ 无法解析JSON响应:', error.message);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求错误:', error.message);
    console.log('请确保后端服务器正在运行在 http://localhost:3000');
  });

  req.end();
}

console.log('🗺️ 测试地图搜索API...');
console.log('请求: GET /api/facilities/map-search?keywords=同济大学&city=上海&limit=5');
console.log('');
testMapSearch();
