# 项目文件夹结构说明

## 📁 文件夹组织

### `/backend/tests/` - 测试文件
包含所有API测试、功能测试和集成测试文件：

- `test-api-search.js` - 设施搜索API完整测试
- `test-full-api.js` - 完整API功能测试 
- `test-api.js` - 基础API测试
- `test-evaluation.js` - 评估功能测试
- `test-facility-feedback.js` - 设施反馈测试
- `test-jwt.js` - JWT认证测试
- `test-database-data.js` - 数据库数据测试
- `test-server.js` - 测试服务器
- `test-simple-server.js` - 简单测试服务器

### `/backend/debug/` - 调试工具
包含开发调试和临时工具文件：

- `debug-sql.js` - SQL查询调试工具
- `simple-test.js` - 简单快速测试工具
- `check-system.js` - 系统检查工具
- `check-tasks.js` - 任务检查工具
- `process-all-tasks.js` - 批量任务处理工具
- `process-real-task.js` - 实际任务处理工具

### `/backend/scripts/` - 脚本工具
包含数据库初始化、数据导入等脚本：

- `init-database.js` - 数据库初始化
- `import-*.js` - 各种数据导入脚本
- `fix-database-schema.js` - 数据库结构修复
- `test-geocode.js` - 地理编码测试

### `/backend/controllers/` - 控制器
- `facilityController_simple.js` - 简化版设施控制器（临时文件）
- `testController.js` - 测试控制器（临时文件）

## 🚀 使用说明

### 运行测试
```bash
# 完整API测试
node tests/test-api-search.js

# 快速基础测试  
node debug/simple-test.js

# 数据库SQL测试
node debug/debug-sql.js
```

### 数据库操作
```bash
# 初始化数据库
node scripts/init-database.js

# 导入设施数据
node scripts/import-shanghai-facilities.js
```

### 系统检查
```bash
# 检查系统状态
node debug/check-system.js

# 检查任务状态
node debug/check-tasks.js
```

## 📝 注意事项

1. **tests/** - 这些文件用于验证功能正常性，开发时可以运行
2. **debug/** - 临时调试工具，生产环境不需要
3. **scripts/** - 数据库维护和数据导入脚本，谨慎使用
4. 所有临时文件都已配置在 `.gitignore` 中
