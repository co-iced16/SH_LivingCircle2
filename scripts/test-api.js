const { pool } = require('./config/database');

async function testEvaluationAPI() {
  try {
    console.log('=== 测试评估结果接口 ===');
    
    // 首先启动一个简单的HTTP服务器来测试API
    const express = require('express');
    const cors = require('cors');
    const evaluationController = require('./controllers/evaluationController');
    
    const app = express();
    app.use(cors());
    app.use(express.json());
    
    // 模拟认证中间件
    const mockAuth = (req, res, next) => {
      req.user = { user_id: 2 }; // 模拟用户ID
      next();
    };
    
    // 添加评估结果接口
    app.get('/evaluation/:id/result', mockAuth, evaluationController.getEvaluationResult);
    
    const server = app.listen(3001, () => {
      console.log('测试服务器启动在端口 3001');
    });
    
    // 等待一下再测试
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试接口
    const fetch = require('node-fetch');
    try {
      const response = await fetch('http://localhost:3001/evaluation/2/result');
      const data = await response.json();
      
      console.log('API响应状态:', response.status);
      console.log('API响应数据:', JSON.stringify(data, null, 2));
    } catch (apiError) {
      console.error('API调用失败:', apiError);
    }
    
    server.close();
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    process.exit();
  }
}

testEvaluationAPI();
