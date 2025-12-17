import api from '@/utils/api'

export default {
  namespaced: true,
  state: {
    user: null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token')
  },
  mutations: {
    SET_USER(state, user) {
      state.user = user
    },
    SET_TOKEN(state, token) {
      state.token = token
      state.isAuthenticated = !!token
      if (token) {
        localStorage.setItem('token', token)
      } else {
        localStorage.removeItem('token')
      }
    },
    LOGOUT(state) {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      localStorage.removeItem('token')
    }
  },
  actions: {
    async login({ commit }, { username, password }) {
      try {
        const response = await api.post('/auth/login', { username, password })
        console.log('登录响应:', response) // 添加调试信息
        
        const { token, user } = response.data
        console.log('Token:', token, 'User:', user) // 添加调试信息
        
        commit('SET_TOKEN', token)
        commit('SET_USER', user)
        
        return { success: true }
      } catch (error) {
        console.error('登录错误:', error) // 添加调试信息
        return { 
          success: false, 
          message: error.response?.data?.message || '登录失败'
        }
      }
    },
    
    async register({ commit }, userData) {
      try {
        const response = await api.post('/auth/register', userData)
        const { token, user } = response.data
        
        commit('SET_TOKEN', token)
        commit('SET_USER', user)
        
        return { success: true }
      } catch (error) {
        return { 
          success: false, 
          message: error.response?.data?.message || '注册失败'
        }
      }
    },
    
    async logout({ commit }) {
      commit('LOGOUT')
    },
    
    async getCurrentUser({ commit, state }) {
      if (!state.token) return
      
      try {
        const response = await api.get('/auth/profile')
        commit('SET_USER', response.data.user || response.data)
        commit('SET_TOKEN', state.token)
      } catch (error) {
        commit('LOGOUT')
      }
    }
  },
  getters: {
    isAuthenticated: state => state.isAuthenticated,
    user: state => state.user,
    userRole: state => state.user?.role || null,
    isAdmin: state => state.user?.role === 'admin'
  }
}
