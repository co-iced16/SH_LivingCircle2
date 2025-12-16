const jwt = require('jsonwebtoken');

// 模拟用户数据
const user = {
  user_id: 2,
  username: 'demo',
  role: 'user'
};

// 使用与后端相同的逻辑生成token
const token = jwt.sign(
  { 
    user_id: user.user_id, 
    username: user.username,
    role: user.role 
  },
  'your_jwt_secret_key', // 这应该与.env文件中的JWT_SECRET相同
  { expiresIn: '24h' }
);

console.log('生成的JWT token:');
console.log(token);

// 验证token
try {
  const decoded = jwt.verify(token, 'your_jwt_secret_key');
  console.log('\n解码的JWT payload:');
  console.log(decoded);
  
  console.log('\n检查字段:');
  console.log('user_id:', decoded.user_id);
  console.log('username:', decoded.username);
  console.log('role:', decoded.role);
} catch (error) {
  console.error('JWT验证失败:', error.message);
}
