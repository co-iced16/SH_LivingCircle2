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
        console.log('创建评估任务API响应:', response.data)
        
        // 处理多种可能的响应格式
        let taskResult;
        
        if (response.data.success && response.data.data) {
          // 标准格式: { success: true, message: '...', data: { task_id } }
          taskResult = {
            success: true,
            data: response.data.data
          }
        } else if (response.data.task_id) {
          // 直接格式: { task_id: 33 }
          taskResult = {
            success: true,
            data: { task_id: response.data.task_id }
          }
        } else if (response.data.success === false) {
          // 错误格式: { success: false, message: '...' }
          taskResult = {
            success: false,
            message: response.data.message || '创建评估任务失败'
          }
        } else {
          // 未知格式，尝试寻找task_id
          console.warn('未知的API响应格式:', response.data)
          taskResult = {
            success: false,
            message: '服务器响应格式异常'
          }
        }
        
        if (taskResult.success) {
          const task = taskResult.data
          commit('SET_CURRENT_TASK', task)
          commit('ADD_EVALUATION_TASK', task)
          console.log('任务创建成功，返回数据:', taskResult)
          return taskResult
        } else {
          console.error('任务创建失败:', taskResult.message)
          return taskResult
        }
      } catch (error) {
        console.error('创建评估任务失败:', error)
        return { 
          success: false, 
          message: error.response?.data?.message || error.message || '创建评估任务失败'
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
