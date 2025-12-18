<template>
  <div class="evaluation-history-container">
    <div class="page-header">
      <h1>评估历史</h1>
      <p>查看您的便利度评估记录</p>
    </div>

    <div class="card-container">
      <!-- 筛选区域 -->
      <div class="filter-section">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索地址"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="8">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              @change="handleSearch"
            />
          </el-col>
          <el-col :span="8" style="text-align: right;">
            <el-button type="primary" @click="$router.push('/evaluation')">
              <el-icon><Plus /></el-icon>
              新建评估
            </el-button>
          </el-col>
        </el-row>
      </div>

      <!-- 评估列表 -->
      <div v-loading="loading" class="history-list">
        <el-empty v-if="!loading && filteredTasks.length === 0" description="暂无评估记录">
          <el-button type="primary" @click="$router.push('/evaluation')">开始评估</el-button>
        </el-empty>

        <div v-else class="task-cards">
          <div
            v-for="task in filteredTasks"
            :key="task.task_id"
            class="task-card"
            @click="viewTaskDetail(task)"
          >
            <div class="task-header">
              <div class="task-score" :style="{ backgroundColor: getScoreColor(task.total_score) }">
                {{ Math.round(task.total_score || 0) }}
              </div>
              <div class="task-info">
                <h3>{{ task.center_address || '未知地址' }}</h3>
                <div class="task-meta">
                  <span><el-icon><Location /></el-icon> 半径 {{ task.radius }}米</span>
                  <span><el-icon><Clock /></el-icon> {{ formatDate(task.created_at) }}</span>
                </div>
              </div>
            </div>
            <div class="task-footer">
              <el-button type="primary" size="small" @click.stop="viewResult(task)">
                查看详情
              </el-button>
              <el-button type="danger" size="small" plain @click.stop="deleteTask(task)">
                删除
              </el-button>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="pagination.total > pagination.limit" class="pagination-wrapper">
          <el-pagination
            v-model:current-page="pagination.page"
            :page-size="pagination.limit"
            :total="pagination.total"
            layout="total, prev, pager, next"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- 任务详情对话框 -->
    <el-dialog v-model="detailVisible" title="评估任务详情" width="700px">
      <div v-if="currentTask" class="task-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="评估地址" :span="2">
            {{ currentTask.center_address }}
          </el-descriptions-item>
          <el-descriptions-item label="评估半径">
            {{ currentTask.radius }}米
          </el-descriptions-item>
          <el-descriptions-item label="便利度得分">
            <span :style="{ color: getScoreColor(currentTask.total_score), fontWeight: 'bold', fontSize: '18px' }">
              {{ Math.round(currentTask.total_score || 0) }}分
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="经度">
            {{ currentTask.longitude }}
          </el-descriptions-item>
          <el-descriptions-item label="纬度">
            {{ currentTask.latitude }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ formatDate(currentTask.created_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="taskCategories.length > 0" style="margin-top: 16px;">
          <h4>关注的设施类别</h4>
          <div class="category-tags">
            <el-tag v-for="cat in taskCategories" :key="cat.category_code" style="margin: 4px;">
              {{ cat.category_name }}
            </el-tag>
          </div>
        </div>

        <div v-if="taskModes.length > 0" style="margin-top: 16px;">
          <h4>交通方式</h4>
          <div class="mode-tags">
            <el-tag v-for="mode in taskModes" :key="mode" type="info" style="margin: 4px;">
              {{ getModeLabel(mode) }}
            </el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="viewResult(currentTask)">查看完整报告</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Location, Clock } from '@element-plus/icons-vue'
import api from '@/utils/api'

export default {
  name: 'EvaluationHistory',
  components: {
    Search,
    Plus,
    Location,
    Clock
  },
  setup() {
    const router = useRouter()
    const store = useStore()

    const loading = ref(false)
    const tasks = ref([])
    const searchKeyword = ref('')
    const dateRange = ref([])
    const detailVisible = ref(false)
    const currentTask = ref(null)
    const taskCategories = ref([])
    const taskModes = ref([])

    const pagination = reactive({
      page: 1,
      limit: 10,
      total: 0
    })

    // 过滤后的任务列表
    const filteredTasks = computed(() => {
      let result = tasks.value

      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        result = result.filter(task =>
          task.center_address?.toLowerCase().includes(keyword)
        )
      }

      if (dateRange.value && dateRange.value.length === 2) {
        const [start, end] = dateRange.value
        result = result.filter(task => {
          const taskDate = new Date(task.created_at).toISOString().split('T')[0]
          return taskDate >= start && taskDate <= end
        })
      }

      return result
    })

    // 加载评估历史
    const loadHistory = async () => {
      loading.value = true
      try {
        const response = await api.get('/evaluation', {
          params: {
            page: pagination.page,
            limit: pagination.limit
          }
        })

        console.log('评估历史API响应:', response)

        // api拦截器已经返回了response.data，所以response就是后端数据对象
        // 后端返回格式: { success: true, data: { tasks: [...], pagination: {...} } }
        const data = response.data || response
        if (data.tasks) {
          tasks.value = data.tasks
          pagination.total = data.pagination?.total || 0
          console.log('加载的任务数:', tasks.value.length)
        }
      } catch (error) {
        console.error('加载评估历史失败:', error)
        ElMessage.error('加载评估历史失败')
      } finally {
        loading.value = false
      }
    }

    // 查看任务详情
    const viewTaskDetail = async (task) => {
      currentTask.value = task
      taskCategories.value = []
      taskModes.value = []

      try {
        const response = await api.get(`/evaluation/${task.task_id}`)
        // api拦截器已经返回了response.data，所以response就是后端数据对象
        if (response.success) {
          taskCategories.value = response.data?.target_categories || []
          taskModes.value = response.data?.transport_modes || []
        }
      } catch (error) {
        console.error('获取任务详情失败:', error)
      }

      detailVisible.value = true
    }

    // 查看评估结果
    const viewResult = (task) => {
      detailVisible.value = false
      router.push(`/evaluation/result/${task.task_id}`)
    }

    // 删除任务
    const deleteTask = async (task) => {
      try {
        await ElMessageBox.confirm('确定要删除这个评估任务吗？', '确认删除', {
          type: 'warning'
        })

        // api拦截器已经返回了response.data，所以response就是后端数据对象
        const response = await api.delete(`/evaluation/${task.task_id}`)
        if (response.success) {
          ElMessage.success(response.message || '删除成功')
          loadHistory()
        } else {
          ElMessage.error(response.message || '删除失败')
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除任务错误:', error)
          // 错误响应也经过拦截器处理，error.response.data 是后端错误数据
          const errorMessage = error.response?.data?.message || error.message || '删除失败'
          ElMessage.error(errorMessage)
        }
      }
    }

    // 搜索处理
    const handleSearch = () => {
      pagination.page = 1
    }

    // 分页处理
    const handlePageChange = (page) => {
      pagination.page = page
      loadHistory()
    }

    // 格式化日期
    const formatDate = (date) => {
      if (!date) return ''
      return new Date(date).toLocaleString('zh-CN')
    }

    // 获取分数颜色
    const getScoreColor = (score) => {
      if (!score) return '#909399'
      if (score >= 80) return '#67c23a'
      if (score >= 60) return '#e6a23c'
      return '#f56c6c'
    }

    // 获取交通方式标签
    const getModeLabel = (mode) => {
      const modeMap = {
        walk: '步行',
        bus: '公交',
        car: '驾车',
        ride: '骑行',
        walking: '步行',
        transit: '公交',
        driving: '驾车',
        cycling: '骑行'
      }
      return modeMap[mode] || mode
    }

    onMounted(() => {
      loadHistory()
    })

    return {
      loading,
      tasks,
      filteredTasks,
      searchKeyword,
      dateRange,
      pagination,
      detailVisible,
      currentTask,
      taskCategories,
      taskModes,
      loadHistory,
      viewTaskDetail,
      viewResult,
      deleteTask,
      handleSearch,
      handlePageChange,
      formatDate,
      getScoreColor,
      getModeLabel
    }
  }
}
</script>

<style scoped>
.evaluation-history-container {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 8px;
}

.page-header p {
  color: #909399;
  font-size: 16px;
  margin: 0;
}

.filter-section {
  margin-bottom: 24px;
}

.history-list {
  min-height: 300px;
}

.task-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.task-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.task-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.task-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.task-score {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  font-weight: bold;
  flex-shrink: 0;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-info h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  gap: 16px;
  color: #909399;
  font-size: 13px;
}

.task-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.task-detail h4 {
  margin: 0 0 8px;
  color: #606266;
  font-size: 14px;
}

.category-tags,
.mode-tags {
  display: flex;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .evaluation-history-container {
    margin: 0 16px;
  }

  .task-cards {
    grid-template-columns: 1fr;
  }

  .task-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>

