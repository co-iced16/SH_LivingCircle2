import api from '@/utils/api'

export default {
  namespaced: true,
  state: {
    currentTask: null,
    evaluationHistory: [],
    loading: false
  },
  mutations: {
    SET_CURRENT_TASK(state, task) {
      state.currentTask = task
    },
    SET_EVALUATION_HISTORY(state, history) {
      state.evaluationHistory = history
    },
    ADD_EVALUATION_TASK(state, task) {
      state.evaluationHistory.unshift(task)
    },
    SET_LOADING(state, loading) {
      state.loading = loading
    }
  },
  actions: {
    async createEvaluationTask({ commit }, taskData) {
      commit('SET_LOADING', true)
      try {
        const response = await api.post('/evaluation', taskData)
        const task = response.data
        commit('SET_CURRENT_TASK', task)
        commit('ADD_EVALUATION_TASK', task)
        return { success: true, task }
      } catch (error) {
        return { 
          success: false, 
          message: error.response?.data?.message || '创建评估任务失败'
        }
      } finally {
        commit('SET_LOADING', false)
      }
    },
    
    async getEvaluationResult({ commit }, taskId) {
      commit('SET_LOADING', true)
      try {
        const response = await api.get(`/evaluation/${taskId}/result`)
        return response.data
      } catch (error) {
        console.error('获取评估结果失败:', error)
        return {
          success: false,
          message: error.response?.data?.message || '获取评估结果失败'
        }
      } finally {
        commit('SET_LOADING', false)
      }
    },
    
    async getEvaluationHistory({ commit }) {
      commit('SET_LOADING', true)
      try {
        const response = await api.get('/evaluation')
        commit('SET_EVALUATION_HISTORY', response.data)
        return response.data
      } catch (error) {
        console.error('获取评估历史失败:', error)
        return []
      } finally {
        commit('SET_LOADING', false)
      }
    }
  },
  getters: {
    currentTaskStatus: state => {
      return state.currentTask?.status || null
    },
    
    recentEvaluations: state => {
      return state.evaluationHistory.slice(0, 5)
    }
  }
}
