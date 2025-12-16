# 上海便民设施便利度评估系统 - 后端API

基于Node.js + Express + MySQL的REST API服务。

## 功能特性

- 🔐 用户认证与授权（JWT）
- 📍 社区与设施反馈管理
- 📊 便利度评估算法
- 🗺️ 高德地图API集成
- 🏥 设施管理（CRUD）
- 📈 数据统计与可视化
- 🛡️ 安全防护（CORS、限流、SQL注入防护）

## 快速开始

### 1. 环境要求

- Node.js >= 16.0.0
- MySQL >= 8.0
- npm >= 7.0.0

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 配置环境

复制 `.env` 文件并根据实际情况修改配置：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sh_living_circle1
DB_USER=root
DB_PASSWORD=Wu998101

# 高德地图API
AMAP_API_KEY=c1e16b086f32deeb23220fa56172a151
```

### 4. 初始化数据库

```bash
npm run init-db
```

### 5. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

服务将在 `http://localhost:3000` 启动。

## API文档

### 认证相关

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "demo",
  "password": "123456",
  "email": "demo@example.com",
  "phone": "13812345678"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "demo",
  "password": "123456"
}
```

### 反馈管理

#### 提交社区反馈
```http
POST /api/feedback/community
Authorization: Bearer <token>
Content-Type: application/json

{
  "location_type": "current",
  "longitude": 121.473701,
  "latitude": 31.230416,
  "address": "上海市黄浦区南京东路",
  "convenience_rating": 4,
  "suggestions": "建议增加更多便民设施"
}
```

#### 提交设施反馈
```http
POST /api/feedback/facility
Authorization: Bearer <token>
Content-Type: application/json

{
  "facility_name": "某某医院",
  "facility_address": "上海市黄浦区",
  "longitude": 121.473701,
  "latitude": 31.230416,
  "rating_environment": 4,
  "rating_service": 5,
  "rating_accessibility": 3,
  "suggestions": "服务很好，环境需要改善"
}
```

### 便利度评估

#### 执行评估
```http
POST /api/evaluation/evaluate
Authorization: Bearer <token>
Content-Type: application/json

{
  "evaluation_type": "basic",
  "longitude": 121.473701,
  "latitude": 31.230416,
  "radius": 1000,
  "weight_education": 0.25,
  "weight_healthcare": 0.25,
  "weight_shopping": 0.25,
  "weight_transport": 0.25
}
```

### 设施管理

#### 搜索设施
```http
GET /api/facilities/search?longitude=121.473701&latitude=31.230416&radius=1000&category_id=1
```

#### 搜索地图POI
```http
GET /api/facilities/poi/search?longitude=121.473701&latitude=31.230416&types=141200&radius=1000
```

### 地图服务

#### 地理编码
```http
GET /api/map/geocode?address=上海市黄浦区南京东路
```

#### 逆地理编码
```http
GET /api/map/reverse-geocode?longitude=121.473701&latitude=31.230416
```

## 数据库结构

### 用户表 (users)
- id: 主键
- username: 用户名（唯一）
- password_hash: 加密密码
- email: 邮箱
- phone: 手机号
- role: 角色（user/admin）

### 设施分类表 (facility_categories)
- id: 主键
- name: 分类名称
- code: 分类代码
- description: 描述

### 设施表 (facilities)
- id: 主键
- name: 设施名称
- category_id: 分类ID
- address: 地址
- longitude/latitude: 坐标
- contact_phone: 联系电话
- business_hours: 营业时间

### 反馈表 (community_feedback, facility_feedback)
- 用户反馈信息
- 评分数据
- 建议内容
- 图片链接（JSON格式）

### 评估记录表 (evaluation_records)
- 评估参数
- 评分结果
- 设施数据（JSON格式）

## 便利度评估算法

评估基于以下四个维度：

1. **教育设施** (25%)：学校、幼儿园、培训机构
2. **医疗设施** (25%)：医院、诊所、药店
3. **购物设施** (25%)：超市、商场、便利店
4. **交通设施** (25%)：地铁、公交、停车场

### 评分规则

- **距离评分**: 距离越近分数越高（300m内100分，500m内80分...）
- **密度评分**: 设施数量越多分数越高（10个以上100分，7个以上80分...）
- **综合评分**: 距离评分60% + 密度评分40%

## 安全特性

- JWT令牌认证
- 密码bcrypt加密
- SQL注入防护
- XSS攻击防护
- CSRF防护
- 请求频率限制
- 输入数据验证

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或令牌无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（自动重启）
npm run dev

# 生产模式
npm start

# 初始化数据库
npm run init-db

# 运行测试
npm test
```

## 部署说明

1. 确保MySQL服务运行正常
2. 配置生产环境的`.env`文件
3. 运行`npm run init-db`初始化数据库
4. 使用PM2等进程管理工具启动服务

```bash
# 使用PM2部署
npm install -g pm2
pm2 start app.js --name "living-circle-api"
```

## 高德地图API说明

系统集成了高德地图API提供以下功能：
- 地理编码/逆地理编码
- POI搜索
- 周边设施查询
- 距离计算

请确保API密钥有足够的调用额度。

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交改动
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License
