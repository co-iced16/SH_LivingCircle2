<template>
  <div class="user-management-container">
    <div class="page-header">
      <h1>用户管理</h1>
      <p>管理系统用户账户</p>
    </div>

    <!-- 数据统计 -->
    <div class="card-container">
      <h2 class="section-title">用户统计</h2>
      <el-row :gutter="24">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">总用户数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.users }}</div>
            <div class="stat-label">普通用户</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.admins }}</div>
            <div class="stat-label">管理员</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.activeUsers }}</div>
            <div class="stat-label">活跃用户</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 用户列表 -->
    <div class="card-container">
      <h2 class="section-title">用户列表</h2>
      
      <div class="toolbar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索用户名或邮箱"
          clearable
          style="width: 300px;"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <el-table :data="users" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="user_id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="feedback_count" label="反馈数" width="100" align="center" />
        <el-table-column prop="evaluation_count" label="评估数" width="100" align="center" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.role === 'user'"
              type="text"
              size="small"
              @click="setAdmin(row)"
            >
              设为管理员
            </el-button>
            <el-button
              v-else-if="row.user_id !== currentUserId"
              type="text"
              size="small"
              @click="setUser(row)"
            >
              取消管理员
            </el-button>
            <el-popconfirm
              v-if="row.user_id !== currentUserId"
              title="确定要删除这个用户吗？"
              @confirm="deleteUser(row)"
            >
              <template #reference>
                <el-button type="text" size="small" style="color: #f56c6c;">
                  删除
                </el-button>
              </template>
            </el-popconfirm>
            <span v-if="row.user_id === currentUserId" class="current-user-tag">当前用户</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          :total="total"
          @size-change="loadUsers"
          @current-change="loadUsers"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

export default {
  name: 'UserManagement',
  setup() {
    const store = useStore()
    const loading = ref(false)
    const users = ref([])
    const searchKeyword = ref('')
    const currentPage = ref(1)
    const pageSize = ref(20)
    const total = ref(0)
    
    const stats = ref({
      total: 0,
      users: 0,
      admins: 0,
      activeUsers: 0
    })

    const currentUserId = computed(() => store.state.auth.user?.id)

    const loadStats = async () => {
      try {
        const res = await api.get('/auth/users/stats')
        if (res.success) {
          stats.value = res.data
        }
      } catch (error) {
        console.error('获取统计数据失败:', error)
      }
    }

    const loadUsers = async () => {
      loading.value = true
      try {
        const res = await api.get('/auth/users', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value || undefined
          }
        })
        console.log('用户列表API响应:', res)
        if (res.success) {
          users.value = res.data.users
          total.value = res.data.pagination.total
          console.log('设置用户数据:', users.value)
        }
      } catch (error) {
        console.error('获取用户列表失败:', error)
        ElMessage.error('获取用户列表失败')
      } finally {
        loading.value = false
      }
    }

    const handleSearch = () => {
      currentPage.value = 1
      loadUsers()
    }

    const setAdmin = async (user) => {
      try {
        const res = await api.put(`/auth/users/${user.user_id}/role`, { role: 'admin' })
        if (res.success) {
          ElMessage.success('已设为管理员')
          loadUsers()
          loadStats()
        }
      } catch (error) {
        ElMessage.error('操作失败')
      }
    }

    const setUser = async (user) => {
      try {
        const res = await api.put(`/auth/users/${user.user_id}/role`, { role: 'user' })
        if (res.success) {
          ElMessage.success('已取消管理员权限')
          loadUsers()
          loadStats()
        }
      } catch (error) {
        ElMessage.error('操作失败')
      }
    }

    const deleteUser = async (user) => {
      try {
        const res = await api.delete(`/auth/users/${user.user_id}`)
        if (res.success) {
          ElMessage.success('用户已删除')
          loadUsers()
          loadStats()
        }
      } catch (error) {
        ElMessage.error('删除失败')
      }
    }

    onMounted(() => {
      loadStats()
      loadUsers()
    })

    return {
      loading,
      users,
      searchKeyword,
      currentPage,
      pageSize,
      total,
      stats,
      currentUserId,
      loadUsers,
      handleSearch,
      setAdmin,
      setUser,
      deleteUser
    }
  }
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

.toolbar {
  margin-bottom: 16px;
}

.stat-card {
  background: white;
  padding: 20px;
  text-align: center;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 8px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.current-user-tag {
  color: #909399;
  font-size: 12px;
}
</style>
