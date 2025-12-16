# 脚本文件夹说明

此文件夹包含用于测试、调试和维护生活圈便利度评估系统的各种脚本文件。

## 📁 脚本清单

### 🔍 测试脚本

#### `test-evaluation.js`
**用途**: 评估算法测试脚本
- 测试评估计算逻辑
- 验证地理距离计算
- 检查设施数据分布
- 调试评分算法

**运行方法**:
```bash
cd scripts
node test-evaluation.js
```

#### `test-jwt.js`
**用途**: JWT令牌测试脚本
- 生成测试JWT令牌
- 验证令牌签名和过期时间
- 用于调试身份认证问题

**运行方法**:
```bash
cd scripts
node test-jwt.js
```

#### `test-api.js`
**用途**: API端点测试脚本
- 测试各个API接口
- 验证请求响应格式
- 调试接口问题

**运行方法**:
```bash
cd scripts
node test-api.js
```

### 🔧 数据处理脚本

#### `process-all-tasks.js`
**用途**: 批量处理评估任务
- 处理所有前端创建的评估任务
- 执行评估计算
- 更新任务得分和详情
- 扩展搜索半径以提高结果准确性

**运行方法**:
```bash
cd scripts
node process-all-tasks.js
```

#### `process-real-task.js`
**用途**: 处理真实评估任务
- 针对特定任务进行评估计算
- 支持自定义参数
- 详细的调试输出

**运行方法**:
```bash
cd scripts
node process-real-task.js
```

### 📊 系统检查脚本

#### `check-system.js`
**用途**: 系统完整性检查
- 验证数据库连接
- 检查表结构完整性
- 验证字段一致性
- 检查配置文件

**运行方法**:
```bash
cd scripts
node check-system.js
```

#### `check-tasks.js`
**用途**: 评估任务状态检查
- 查看前端创建的评估任务
- 检查任务完成状态
- 验证任务数据完整性

**运行方法**:
```bash
cd scripts
node check-tasks.js
```

## 🚀 使用指南

### 环境要求
- Node.js 环境
- MySQL 数据库连接
- 正确配置的 `.env` 文件（位于 `backend` 文件夹）

### 运行前准备
1. 确保后端数据库服务正常运行
2. 确保 `backend/.env` 文件配置正确
3. 在 `scripts` 文件夹中运行脚本

### 常见使用场景

#### 1. 系统部署后验证
```bash
cd scripts
node check-system.js
```

#### 2. 评估功能测试
```bash
cd scripts
node test-evaluation.js
```

#### 3. 处理积压的评估任务
```bash
cd scripts
node process-all-tasks.js
```

#### 4. 检查评估任务状态
```bash
cd scripts
node check-tasks.js
```

## ⚠️ 注意事项

1. **数据库操作**: 部分脚本会修改数据库数据，运行前请备份重要数据
2. **环境依赖**: 确保从正确的目录运行脚本，以保证路径引用正确
3. **调试模式**: 脚本包含详细的日志输出，便于问题诊断
4. **生产环境**: 在生产环境中使用时请谨慎，建议先在测试环境验证

## 🔧 脚本维护

- **路径配置**: 所有脚本已配置为从 `scripts` 文件夹运行，正确引用 `backend` 中的配置文件
- **依赖管理**: 脚本依赖后端的配置和数据库连接池
- **版本控制**: 脚本文件应与主项目代码同步更新

## 📝 开发说明

这些脚本是在开发和调试过程中创建的实用工具，用于：
- 快速验证系统功能
- 处理数据问题
- 调试算法逻辑
- 系统维护操作

如需添加新的脚本，请遵循相同的命名和组织规范。
