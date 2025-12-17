<template>
  <div class="layout-container">
    <el-container>
      <!-- 顶部导航 -->
      <el-header class="layout-header">
        <div class="header-left">
          <h2 class="logo">社区生活圈便利度评估系统</h2>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32">
                <el-icon><User /></el-icon>
              </el-avatar>
              <span class="username">{{ user?.username }}</span>
              <el-icon class="el-icon--right"><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人设置</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-container>
        <!-- 侧边菜单 -->
        <el-aside width="250px" class="layout-aside">
          <el-menu
            :default-active="$route.path"
            router
            class="sidebar-menu"
            background-color="#001529"
            text-color="#ffffff"
            active-text-color="#409EFF"
          >
            <el-menu-item index="/dashboard">
              <el-icon><House /></el-icon>
              <span>首页</span>
            </el-menu-item>
            
            <el-sub-menu index="feedback">
              <template #title>
                <el-icon><ChatDotRound /></el-icon>
                <span>反馈评价</span>
              </template>
              <el-menu-item index="/feedback/community">
                <el-icon><OfficeBuilding /></el-icon>
                <span>社区评价</span>
              </el-menu-item>
              <el-menu-item index="/feedback/facility">
                <el-icon><Shop /></el-icon>
                <span>设施评价</span>
              </el-menu-item>
            </el-sub-menu>
            
            <el-sub-menu index="evaluation">
              <template #title>
                <el-icon><DataAnalysis /></el-icon>
                <span>便利度评估</span>
              </template>
              <el-menu-item index="/evaluation">
                <el-icon><Plus /></el-icon>
                <span>新建评估</span>
              </el-menu-item>
              <el-menu-item index="/evaluation/history">
                <el-icon><Clock /></el-icon>
                <span>评估历史</span>
              </el-menu-item>
            </el-sub-menu>
            
            <el-sub-menu index="admin" v-if="isAdmin">
              <template #title>
                <el-icon><Setting /></el-icon>
                <span>系统管理</span>
              </template>
              <el-menu-item index="/admin/facilities">
                <el-icon><Shop /></el-icon>
                <span>设施管理</span>
              </el-menu-item>
              <el-menu-item index="/admin/reports">
                <el-icon><Document /></el-icon>
                <span>报告管理</span>
              </el-menu-item>
              <el-menu-item index="/admin/users">
                <el-icon><UserFilled /></el-icon>
                <span>用户管理</span>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </el-aside>

        <!-- 主内容区域 -->
        <el-main class="layout-main">
          <!-- 面包屑 -->
          <div class="breadcrumb-container">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="$route.meta.title">{{ $route.meta.title }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          
          <!-- 页面内容 -->
          <div class="page-content">
            <router-view />
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'

export default {
  name: 'Layout',
  setup() {
    const store = useStore()
    const router = useRouter()
    
    const user = computed(() => store.getters['auth/user'])
    const isAdmin = computed(() => store.getters['auth/isAdmin'])
    
    const handleCommand = async (command) => {
      if (command === 'logout') {
        try {
          await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })
          
          await store.dispatch('auth/logout')
          router.push('/login')
        } catch (error) {
          // 用户取消操作
        }
      } else if (command === 'profile') {
        // 跳转到个人设置页面
        router.push('/profile')
      }
    }
    
    return {
      user,
      isAdmin,
      handleCommand
    }
  }
}
</script>

<style scoped>
.layout-container {
  min-height: 100vh;
}

.layout-header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.header-left .logo {
  color: #1890ff;
  font-weight: 600;
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: #f5f5f5;
}

.username {
  margin: 0 8px;
  font-size: 14px;
}

.layout-aside {
  background: #001529;
  overflow: hidden;
}

.sidebar-menu {
  border-right: none;
  height: calc(100vh - 60px);
}

.sidebar-menu .el-menu-item,
.sidebar-menu .el-sub-menu__title {
  height: 48px;
  line-height: 48px;
}

.layout-main {
  background: #f0f2f5;
  padding: 0;
  overflow-y: auto;
}

.breadcrumb-container {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.page-content {
  padding: 24px;
  min-height: calc(100vh - 140px);
}

@media (max-width: 768px) {
  .layout-aside {
    width: 200px !important;
  }
  
  .header-left .logo {
    font-size: 16px;
  }
  
  .page-content {
    padding: 16px;
  }
}
</style>
