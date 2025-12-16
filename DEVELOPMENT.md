# 开发指南

## 启动项目

### 方法一：使用VS Code任务
1. 打开VS Code
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "Tasks: Run Task"
4. 选择 "Start Frontend Dev Server"

### 方法二：使用终端
```bash
# 进入前端目录
cd frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run serve
```

## 默认账户信息

由于后端尚未实现，可以使用以下信息进行前端测试：
- 用户名: `demo`
- 密码: `123456`

## 高德地图API配置

1. 访问 [高德开放平台](https://console.amap.com/)
2. 注册并创建应用获取API Key
3. 在 `frontend/.env` 文件中配置：
```env
VUE_APP_AMAP_KEY=你的高德地图API密钥
```
4. 在 `public/index.html` 中更新script标签中的key参数

## 项目结构说明

```
frontend/
├── public/
│   └── index.html          # HTML模板
├── src/
│   ├── assets/             # 静态资源
│   ├── components/         # 通用组件
│   │   └── Layout.vue      # 主布局组件
│   ├── router/             # 路由配置
│   ├── store/              # Vuex状态管理
│   │   └── modules/        # 状态模块
│   ├── utils/              # 工具函数
│   ├── views/              # 页面组件
│   │   ├── auth/           # 认证页面
│   │   ├── feedback/       # 反馈页面
│   │   ├── evaluation/     # 评估页面
│   │   └── admin/          # 管理页面
│   ├── App.vue             # 根组件
│   └── main.js             # 入口文件
├── .env                    # 环境变量
├── vue.config.js           # Vue配置
└── package.json            # 项目依赖
```

## 功能模块

### 1. 用户认证 (`/views/auth/`)
- 登录页面
- 注册页面
- 路由守卫

### 2. 社区反馈 (`/views/feedback/CommunityFeedback.vue`)
- 位置选择（当前位置/坐标输入/地址搜索）
- 地图交互
- 评价表单

### 3. 设施反馈 (`/views/feedback/FacilityFeedback.vue`)
- 系统设施搜索
- 地图POI搜索
- 分步骤评价流程

### 4. 便利度评估 (`/views/evaluation/`)
- 多步骤评估流程
- 参数配置
- 实时进度显示
- 结果可视化

### 5. 管理功能 (`/views/admin/`)
- 设施管理
- 用户管理
- 报告管理

## 开发注意事项

1. **组件规范**: 所有组件都应该有清晰的props和事件定义
2. **样式规范**: 使用scoped样式，避免全局污染
3. **API调用**: 统一使用utils/api.js中的axios实例
4. **错误处理**: 所有异步操作都应该有错误处理
5. **响应式设计**: 确保在移动端和桌面端都有良好的体验

## 常见问题

### Q: 地图不显示怎么办？
A: 检查高德地图API密钥是否正确配置，网络是否正常。

### Q: 路由跳转后页面空白？
A: 检查对应的Vue组件文件是否存在，路由配置是否正确。

### Q: Element Plus组件样式异常？
A: 确保已正确引入Element Plus的CSS文件。

### Q: 如何添加新的功能页面？
A: 
1. 在`views`目录下创建新的Vue文件
2. 在`router/index.js`中添加路由配置
3. 如需要，在导航菜单中添加链接

## 下一步开发计划

1. **后端API开发**: 实现数据存储和业务逻辑
2. **数据库设计**: 根据需求分析实现数据库结构
3. **地图功能完善**: 添加更多地图交互功能
4. **数据可视化**: 丰富评估结果的图表展示
5. **性能优化**: 代码分割、懒加载等优化

---

如有其他问题，请查看项目README或提交Issue。
