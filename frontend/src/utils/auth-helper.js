/**
 * 认证相关辅助工具
 */

export const authHelper = {
  /**
   * 快速登录demo用户（用于测试）
   */
  async quickLoginDemo(store) {
    try {
      const result = await store.dispatch('auth/login', {
        username: 'demo',
        password: '123456'
      })
      
      if (result.success) {
        console.log('Demo用户登录成功')
        return true
      } else {
        console.error('Demo用户登录失败:', result.message)
        return false
      }
    } catch (error) {
      console.error('快速登录出错:', error)
      return false
    }
  },

  /**
   * 检查token是否有效
   */
  isTokenValid(token) {
    if (!token) return false
    
    try {
      // 简单检查token格式（实际项目中应该验证JWT）
      const parts = token.split('.')
      return parts.length === 3
    } catch (error) {
      return false
    }
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser(store) {
    return store.state.auth.user
  },

  /**
   * 检查是否已登录
   */
  isAuthenticated(store) {
    return store.state.auth.isAuthenticated && store.state.auth.token
  }
}
