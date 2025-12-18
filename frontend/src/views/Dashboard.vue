<template>
  <div class="dashboard-container">
    <!-- 欢迎卡片 -->
    <div class="card-container welcome-card">
      <h1>欢迎使用社区生活圈便利度评估系统</h1>
      <p>通过科学的评估方法，为您提供准确的社区便利度分析</p>
    </div>

    <!-- 功能快速入口 -->
    <div class="quick-actions">
      <h2 class="section-title">功能快速入口</h2>
      <el-row :gutter="24">
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <div class="action-card" @click="$router.push('/feedback/community')">
            <div class="action-icon">
              <el-icon size="32"><OfficeBuilding /></el-icon>
            </div>
            <h3>社区评价</h3>
            <p>对社区整体便利性进行评价</p>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <div class="action-card" @click="$router.push('/feedback/facility')">
            <div class="action-icon">
              <el-icon size="32"><Shop /></el-icon>
            </div>
            <h3>设施评价</h3>
            <p>对具体设施服务进行评价</p>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <div class="action-card" @click="$router.push('/evaluation')">
            <div class="action-icon">
              <el-icon size="32"><DataAnalysis /></el-icon>
            </div>
            <h3>便利度评估</h3>
            <p>科学评估社区生活便利度</p>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-if="isAdmin">
          <div class="action-card" @click="$router.push('/admin')">
            <div class="action-icon">
              <el-icon size="32"><Setting /></el-icon>
            </div>
            <h3>系统管理</h3>
            <p>管理系统数据和生成报告</p>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <h2 class="section-title">数据概览</h2>
      <el-row :gutter="24" v-loading="loading">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #e6f7ff; color: #1890ff;">
              <el-icon size="24"><Shop /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ stats.facilitiesCount }}</div>
              <div class="stat-label">设施数量</div>
            </div>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #f6ffed; color: #52c41a;">
              <el-icon size="24"><ChatDotRound /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ stats.feedbacksCount }}</div>
              <div class="stat-label">反馈数量</div>
            </div>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #fff7e6; color: #fa8c16;">
              <el-icon size="24"><DataAnalysis /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ stats.evaluationsCount }}</div>
              <div class="stat-label">评估次数</div>
            </div>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #f9f0ff; color: #722ed1;">
              <el-icon size="24"><UserFilled /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ stats.usersCount }}</div>
              <div class="stat-label">用户数量</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 最近活动 -->
    <div class="recent-activity">
      <h2 class="section-title">最近活动</h2>
      <div class="card-container" v-loading="loading">
        <el-timeline v-if="recentActivities.length > 0">
          <el-timeline-item
            v-for="activity in recentActivities"
            :key="activity.id"
            :timestamp="activity.timestamp"
            :color="activity.color"
          >
            <h4>{{ activity.title }}</h4>
            <p>{{ activity.description }}</p>
          </el-timeline-item>
        </el-timeline>
        
        <div v-else class="empty-state">
          <el-icon size="48" class="icon"><Document /></el-icon>
          <p>暂无活动记录</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

export default {
  name: 'Dashboard',
  setup() {
    const store = useStore()
    
    const isAdmin = computed(() => store.getters['auth/isAdmin'])
    const loading = ref(false)
    
    const stats = ref({
      facilitiesCount: 0,
      feedbacksCount: 0,
      evaluationsCount: 0,
      usersCount: 0
    })
    
    const recentActivities = ref([])
    
    // 加载统计数据
    const loadDashboardStats = async () => {
      try {
        loading.value = true
        const res = await api.get('/dashboard/stats')
        console.log('📊 首页统计数据响应:', res)
        if (res.success && res.data) {
          stats.value = {
            facilitiesCount: Number(res.data.facilitiesCount) || 0,
            feedbacksCount: Number(res.data.feedbacksCount) || 0,
            evaluationsCount: Number(res.data.evaluationsCount) || 0,
            usersCount: Number(res.data.usersCount) || 0
          }
          console.log('📊 设置后的统计数据:', stats.value)
        } else {
          console.warn('⚠️ 统计数据响应格式异常:', res)
        }
      } catch (error) {
        console.error('加载统计数据失败:', error)
        ElMessage.error('加载统计数据失败')
      } finally {
        loading.value = false
      }
    }
    
    // 加载最近活动
    const loadRecentActivities = async () => {
      try {
        const res = await api.get('/dashboard/activities', {
          params: { limit: 10 }
        })
        if (res.success) {
          recentActivities.value = res.data || []
        }
      } catch (error) {
        console.error('加载最近活动失败:', error)
        // 不显示错误消息，因为这不是关键功能
      }
    }
    
    // 加载所有数据
    const loadDashboardData = async () => {
      await Promise.all([
        loadDashboardStats(),
        loadRecentActivities()
      ])
    }
    
    onMounted(() => {
      loadDashboardData()
    })
    
    return {
      isAdmin,
      stats,
      recentActivities,
      loading
    }
  }
}
</script>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  margin-bottom: 32px;
}

.welcome-card h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 12px;
}

.welcome-card p {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

.quick-actions {
  margin-bottom: 32px;
}

.action-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
  height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.action-icon {
  color: #1890ff;
  margin-bottom: 16px;
}

.action-card h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #303133;
}

.action-card p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.stats-overview {
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.recent-activity .card-container {
  min-height: 200px;
}

.recent-activity .el-timeline-item h4 {
  margin: 0 0 4px;
  font-size: 16px;
  color: #303133;
}

.recent-activity .el-timeline-item p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

@media (max-width: 768px) {
  .welcome-card h1 {
    font-size: 22px;
  }
  
  .welcome-card p {
    font-size: 14px;
  }
  
  .action-card {
    height: auto;
    min-height: 140px;
  }
  
  .stat-card {
    padding: 16px;
  }
  
  .stat-number {
    font-size: 20px;
  }
}
</style>
