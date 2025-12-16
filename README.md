# 社区生活圈便利度评估系统

本系统是一个全面的社区生活圈便利度评估平台，整合城市设施数据与居民反馈信息，构建科学的便利度量化评估模型。

## 项目结构

```
SH_LivingCircle_2/
├── frontend/          # Vue.js 前端应用
├── backend/           # 后端API服务
├── scripts/           # 部署和工具脚本
└── CLAUDE.md         # 需求分析文档
```

## 功能特色

### 用户功能
- **社区评价**: 对社区整体便利性进行评价
- **设施评价**: 对具体设施服务进行评价
- **便利度评估**: 科学评估社区生活便利度
- **地图集成**: 高德地图API支持位置选择和导航

### 管理员功能
- **设施管理**: 管理系统中的设施数据
- **用户管理**: 管理系统用户账户
- **报告生成**: 生成规划辅助分析报告

### 技术亮点
- 响应式设计，支持移动端和桌面端
- 现代化UI设计，用户体验友好
- 实时地图交互和位置服务
- 数据可视化图表展示
- 模块化架构，易于扩展

## 快速开始

### 环境要求
- Node.js 16+ 
- npm 或 yarn

### 前端启动

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run serve
```

4. 访问应用
打开浏览器访问 `http://localhost:8080`

### 高德地图配置

1. 在高德开放平台申请API密钥: https://console.amap.com/
2. 在 `frontend/.env` 文件中配置您的API密钥:
```env
VUE_APP_AMAP_KEY=YOUR_AMAP_KEY_HERE
```

## 主要页面

### 登录注册
- `/login` - 用户登录
- `/register` - 用户注册

### 主要功能
- `/dashboard` - 系统首页
- `/feedback/community` - 社区评价
- `/feedback/facility` - 设施评价
- `/evaluation` - 便利度评估
- `/evaluation/result/:taskId` - 评估结果

### 管理功能（需要管理员权限）
- `/admin/facilities` - 设施管理
- `/admin/users` - 用户管理
- `/admin/reports` - 报告管理

## 技术栈

### 前端
- **Vue 3** - 渐进式JavaScript框架
- **Vue Router 4** - 官方路由管理器
- **Vuex 4** - 状态管理
- **Element Plus** - Vue 3组件库
- **ECharts** - 数据可视化
- **高德地图API** - 地图服务

### 后端（计划）
- Node.js/Express 或 Python/Django
- MySQL/PostgreSQL 数据库
- Redis 缓存

## 项目特点

### 用户体验
1. **直观的界面设计**: 现代化的UI/UX设计，操作简单直观
2. **响应式布局**: 完美支持手机、平板、桌面设备
3. **实时反馈**: 操作结果实时反馈，提升用户体验

### 功能完整性
1. **完整的评估流程**: 从位置选择到结果展示的完整链路
2. **多维度评估**: 设施数量、交通便利、用户反馈综合评估
3. **数据可视化**: 图表化展示评估结果和统计数据

### 技术先进性
1. **模块化设计**: 组件化开发，代码可维护性强
2. **API集成**: 高德地图API深度集成
3. **数据驱动**: 基于真实数据的科学评估模型

## 开发状态

✅ **已完成**
- 用户认证系统（登录/注册）
- 社区评价功能
- 设施评价功能  
- 便利度评估功能
- 评估结果展示
- 设施管理功能
- 响应式UI设计

🚧 **开发中**
- 后端API服务
- 数据库设计实现
- 用户管理功能
- 报告生成功能

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系我们

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发送邮件至项目维护者

---

感谢使用社区生活圈便利度评估系统！
