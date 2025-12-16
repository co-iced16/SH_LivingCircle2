<template>
  <div class="report-management-container">
    <div class="page-header">
      <h1>报告管理</h1>
      <p>查看和管理规划辅助分析报告</p>
    </div>

    <div class="card-container">
      <h2 class="section-title">功能开发中...</h2>
      <el-empty description="报告管理功能正在开发中，敬请期待">
        <el-button type="primary">返回首页</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReportManagement'
}
</script>

<style scoped>
.report-management-container {
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
