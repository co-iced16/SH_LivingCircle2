<template>
  <div class="user-management-container">
    <div class="page-header">
      <h1>用户管理</h1>
      <p>管理系统用户账户</p>
    </div>

    <div class="card-container">
      <h2 class="section-title">功能开发中...</h2>
      <el-empty description="用户管理功能正在开发中，敬请期待">
        <el-button type="primary">返回首页</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UserManagement'
}
</script>

<style scoped>
.user-management-container {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 8px;
}

.page-header p {
  color: #909399;
  margin: 0;
}
</style>
