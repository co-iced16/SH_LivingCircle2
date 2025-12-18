<template>
  <div class="feedback-management-container">
    <div class="page-header">
      <h1>反馈管理</h1>
      <p>查看和管理所有用户反馈（社区评价和设施评价）</p>
    </div>

    <!-- 筛选工具栏 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="反馈类型">
          <el-select v-model="filters.feedback_type" placeholder="全部类型" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="社区评价" value="community" />
            <el-option label="设施评价" value="facility" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索用户名、内容、地址"
            clearable
            style="width: 300px"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 反馈列表 -->
    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>反馈列表</span>
          <span class="total-count">共 {{ pagination.total }} 条</span>
        </div>
      </template>
      <el-table :data="feedbacks" v-loading="loading" stripe>
        <el-table-column prop="feedback_id" label="ID" width="80" />
        <el-table-column prop="username" label="用户" width="120" />
        <el-table-column prop="feedback_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.feedback_type === 'community' ? 'primary' : 'success'">
              {{ row.feedback_type === 'community' ? '社区评价' : '设施评价' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="score" label="评分" width="100" align="center">
          <template #default="{ row }">
            <el-rate
              :model-value="row.score"
              disabled
              show-score
              text-color="#ff9900"
              score-template="{value}"
            />
          </template>
        </el-table-column>
        <el-table-column prop="target_name" label="评价对象" min-width="200">
          <template #default="{ row }">
            <span v-if="row.feedback_type === 'facility'">{{ row.target_name || '-' }}</span>
            <span v-else-if="row.feedback_type === 'community' && row.community_longitude && row.community_latitude">
              {{ row.community_longitude }}, {{ row.community_latitude }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="位置/地址" min-width="250" show-overflow-tooltip />
        <el-table-column prop="content" label="评价内容" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.content">{{ row.content }}</span>
            <span v-else class="text-muted">无内容</span>
          </template>
        </el-table-column>
        <el-table-column prop="submitted_at" label="提交时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.submitted_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              @click="handleDelete(row)"
              :loading="deletingId === row.feedback_id"
            >
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
        layout="total, prev, pager, next, jumper"
        @current-change="handlePageChange"
        class="pagination"
      />
    </el-card>
  </div>
</template>

<script>
import api from '@/utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

export default {
  name: 'FeedbackManagement',
  components: {
    Search
  },
  data() {
    return {
      feedbacks: [],
      loading: false,
      deletingId: null,
      filters: {
        feedback_type: '',
        keyword: ''
      },
      pagination: {
        page: 1,
        limit: 10,
        total: 0
      }
    }
  },
  mounted() {
    this.fetchFeedbacks()
  },
  methods: {
    async fetchFeedbacks() {
      this.loading = true
      try {
        const params = {
          page: this.pagination.page,
          limit: this.pagination.limit,
          ...this.filters
        }
        // 移除空值
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null) {
            delete params[key]
          }
        })

        const res = await api.get('/feedback/all', { params })
        if (res.success) {
          this.feedbacks = res.data.feedbacks
          this.pagination = { ...this.pagination, ...res.data.pagination }
        }
      } catch (error) {
        console.error('获取反馈列表失败:', error)
        ElMessage.error('获取反馈列表失败')
      } finally {
        this.loading = false
      }
    },
    handleSearch() {
      this.pagination.page = 1
      this.fetchFeedbacks()
    },
    handleReset() {
      this.filters = {
        feedback_type: '',
        keyword: ''
      }
      this.pagination.page = 1
      this.fetchFeedbacks()
    },
    handlePageChange(page) {
      this.pagination.page = page
      this.fetchFeedbacks()
    },
    async handleDelete(row) {
      try {
        await ElMessageBox.confirm(
          `确定要删除这条${row.feedback_type === 'community' ? '社区评价' : '设施评价'}吗？`,
          '提示',
          {
            type: 'warning',
            confirmButtonText: '确定',
            cancelButtonText: '取消'
          }
        )

        this.deletingId = row.feedback_id
        const res = await api.delete(`/feedback/${row.feedback_id}`)
        if (res.success) {
          ElMessage.success('删除成功')
          this.fetchFeedbacks()
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除反馈失败:', error)
          ElMessage.error('删除失败')
        }
      } finally {
        this.deletingId = null
      }
    },
    formatDate(date) {
      if (!date) return ''
      return new Date(date).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.feedback-management-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
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

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  margin: 0;
}

.list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-count {
  color: #909399;
  font-size: 14px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.text-muted {
  color: #c0c4cc;
  font-style: italic;
}
</style>
