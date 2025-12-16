const http = require('http');

function testAPI() {
  const keywords = encodeURIComponent('医院');
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/facilities/search?keywords=${keywords}&limit=3`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('API响应:');
        console.log(JSON.stringify(jsonData, null, 2));
        
        if (jsonData.success && jsonData.data && jsonData.data.facilities && jsonData.data.facilities.length > 0) {
          console.log('\n✅ API测试成功！');
          console.log(`找到 ${jsonData.data.facilities.length} 个设施`);
          console.log('第一个设施:', jsonData.data.facilities[0].name);
          console.log('总共有设施:', jsonData.data.pagination.total);
          console.log('总页数:', jsonData.data.pagination.pages);
        } else {
          console.log('\n❌ API返回了数据，但结构不符合预期');
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

console.log('🔍 测试设施搜索API...');
console.log('请求: GET /api/facilities/search?keywords=医院&limit=3');
console.log('');
testAPI();
