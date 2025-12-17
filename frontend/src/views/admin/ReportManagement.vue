<template>
  <div class="report-management-container">
    <div class="page-header">
      <h1>规划报告管理</h1>
      <p>生成和管理社区便利度分析报告</p>
    </div>

    <!-- 创建报告 -->
    <el-card class="create-card">
      <template #header>
        <span>创建新报告</span>
      </template>
      <el-form :model="newReport" label-width="100px" @submit.prevent="createReport">
        <el-form-item label="报告标题">
          <el-input v-model="newReport.title" placeholder="请输入报告标题" />
        </el-form-item>
        <el-form-item label="分析时段">
          <el-date-picker
            v-model="newReport.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="createReport" :loading="creating">
            创建报告
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 报告列表 -->
    <el-card class="list-card">
      <template #header>
        <span>报告列表</span>
      </template>
      <el-table :data="reports" v-loading="loading" stripe>
        <el-table-column prop="report_id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="admin_name" label="创建者" width="120" />
        <el-table-column label="分析时段" width="200">
          <template #default="{ row }">
            {{ row.start_date }} ~ {{ row.end_date }}
          </template>
        </el-table-column>
        <el-table-column prop="generated_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.generated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button size="small" @click="viewReport(row)">查看</el-button>
            <el-button size="small" type="success" @click="generateAnalysis(row)">
              生成分析
            </el-button>
            <el-button size="small" type="danger" @click="deleteReport(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="pagination.total > 0"
        :current-page="pagination.page"
        :page-size="pagination.limit"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
        class="pagination"
      />
    </el-card>

    <!-- 报告详情对话框 -->
    <el-dialog v-model="detailVisible" title="报告详情" width="700px">
      <div v-if="currentReport">
        <h3>{{ currentReport.title }}</h3>
        <p>分析时段: {{ currentReport.start_date }} ~ {{ currentReport.end_date }}</p>
        
        <h4>短板分析结果</h4>
        <el-table :data="deficiencies" v-if="deficiencies.length > 0">
          <el-table-column prop="category_name" label="设施类别" />
          <el-table-column prop="problem_type" label="问题类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getProblemTagType(row.problem_type)">
                {{ getProblemLabel(row.problem_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="suggestion" label="建议" />
        </el-table>
        <el-empty v-else description="暂无分析数据，请点击'生成分析'" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import api from '@/utils/api'

export default {
  name: 'ReportManagement',
  data() {
    return {
      reports: [],
      loading: false,
      creating: false,
      pagination: { page: 1, limit: 10, total: 0 },
      newReport: {
        title: '',
        dateRange: []
      },
      detailVisible: false,
      currentReport: null,
      deficiencies: []
    }
  },
  mounted() {
    this.fetchReports()
  },
  methods: {
    async fetchReports() {
      this.loading = true
      try {
        const res = await api.get('/reports', {
          params: { page: this.pagination.page, limit: this.pagination.limit }
        })
        if (res.success) {
          this.reports = res.data.reports
          this.pagination = { ...this.pagination, ...res.data.pagination }
        }
      } catch (error) {
        this.$message.error('获取报告列表失败')
      } finally {
        this.loading = false
      }
    },
    async createReport() {
      if (!this.newReport.title || !this.newReport.dateRange?.length) {
        this.$message.warning('请填写完整信息')
        return
      }
      this.creating = true
      try {
        const res = await api.post('/reports', {
          title: this.newReport.title,
          start_date: this.newReport.dateRange[0],
          end_date: this.newReport.dateRange[1],
          region_boundary: null
        })
        if (res.success) {
          this.$message.success('报告创建成功')
          this.newReport = { title: '', dateRange: [] }
          this.fetchReports()
        }
      } catch (error) {
        this.$message.error('创建报告失败')
      } finally {
        this.creating = false
      }
    },
    async viewReport(row) {
      try {
        const res = await api.get(`/reports/${row.report_id}`)
        if (res.success) {
          this.currentReport = res.data.report
          this.deficiencies = res.data.deficiencies
          this.detailVisible = true
        }
      } catch (error) {
        this.$message.error('获取报告详情失败')
      }
    },
    async generateAnalysis(row) {
      try {
        const res = await api.post(`/reports/${row.report_id}/analyze`)
        if (res.success) {
          this.$message.success(res.data.message)
          this.viewReport(row)
        }
      } catch (error) {
        this.$message.error('生成分析失败')
      }
    },
    async deleteReport(row) {
      try {
        await this.$confirm('确定要删除此报告吗？', '提示', { type: 'warning' })
        const res = await api.delete(`/reports/${row.report_id}`)
        if (res.success) {
          this.$message.success('删除成功')
          this.fetchReports()
        }
      } catch (error) {
        if (error !== 'cancel') {
          this.$message.error('删除失败')
        }
      }
    },
    handlePageChange(page) {
      this.pagination.page = page
      this.fetchReports()
    },
    formatDate(date) {
      return date ? new Date(date).toLocaleString('zh-CN') : ''
    },
    getProblemTagType(type) {
      const map = { missing: 'danger', low_score: 'warning', remote: 'info' }
      return map[type] || ''
    },
    getProblemLabel(type) {
      const map = { missing: '数量不足', low_score: '评分低', remote: '距离远' }
      return map[type] || type
    }
  }
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

.create-card {
  margin-bottom: 20px;
}

.list-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
