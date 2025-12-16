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
      <el-row :gutter="24">
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
      <div class="card-container">
        <el-timeline>
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
        
        <div v-if="recentActivities.length === 0" class="empty-state">
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

export default {
  name: 'Dashboard',
  setup() {
    const store = useStore()
    
    const isAdmin = computed(() => store.getters['auth/isAdmin'])
    
    const stats = ref({
      facilitiesCount: 0,
      feedbacksCount: 0,
      evaluationsCount: 0,
      usersCount: 0
    })
    
    const recentActivities = ref([
      {
        id: 1,
        title: '新用户注册',
        description: '用户 "张三" 注册了账户',
        timestamp: '2023-12-08 14:30',
        color: '#52c41a'
      },
      {
        id: 2,
        title: '社区评价提交',
        description: '用户对 "静安区某小区" 提交了评价',
        timestamp: '2023-12-08 13:45',
        color: '#1890ff'
      },
      {
        id: 3,
        title: '便利度评估完成',
        description: '完成了 "徐汇区田林街道" 的便利度评估',
        timestamp: '2023-12-08 12:15',
        color: '#fa8c16'
      }
    ])
    
    const loadDashboardData = async () => {
      try {
        // 这里应该调用API获取统计数据
        // const response = await api.get('/dashboard/stats')
        // stats.value = response.data
        
        // 模拟数据
        stats.value = {
          facilitiesCount: 1256,
          feedbacksCount: 489,
          evaluationsCount: 156,
          usersCount: 89
        }
      } catch (error) {
        console.error('加载仪表板数据失败:', error)
      }
    }
    
    onMounted(() => {
      loadDashboardData()
    })
    
    return {
      isAdmin,
      stats,
      recentActivities
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
