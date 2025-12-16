import api from '@/utils/api'

export default {
  namespaced: true,
  state: {
    communityFeedbacks: [],
    facilityFeedbacks: [],
    loading: false
  },
  mutations: {
    SET_COMMUNITY_FEEDBACKS(state, feedbacks) {
      state.communityFeedbacks = feedbacks
    },
    SET_FACILITY_FEEDBACKS(state, feedbacks) {
      state.facilityFeedbacks = feedbacks
    },
    ADD_COMMUNITY_FEEDBACK(state, feedback) {
      state.communityFeedbacks.unshift(feedback)
    },
    ADD_FACILITY_FEEDBACK(state, feedback) {
      state.facilityFeedbacks.unshift(feedback)
    },
    SET_LOADING(state, loading) {
      state.loading = loading
    }
  },
  actions: {
    async submitCommunityFeedback({ commit }, feedbackData) {
      try {
        const response = await api.post('/feedback/community', feedbackData)
        commit('ADD_COMMUNITY_FEEDBACK', response.data)
        return { success: true }
      } catch (error) {
        let message = '提交失败'
        
        if (error.response) {
          const status = error.response.status
          const responseMessage = error.response.data?.message
          
          if (status === 401) {
            message = '登录已过期，请重新登录'
          } else if (status === 403) {
            message = '权限不足，请先登录'
          } else {
            message = responseMessage || '提交失败'
          }
        }
        
        return { 
          success: false, 
          message
        }
      }
    },
    
    async submitFacilityFeedback({ commit }, feedbackData) {
      try {
        const response = await api.post('/feedback/facility', feedbackData)
        commit('ADD_FACILITY_FEEDBACK', response.data)
        return { success: true }
      } catch (error) {
        let message = '提交失败'
        
        if (error.response) {
          const status = error.response.status
          const responseMessage = error.response.data?.message
          
          if (status === 401) {
            message = '登录已过期，请重新登录'
          } else if (status === 403) {
            message = '权限不足，请先登录'
          } else {
            message = responseMessage || '提交失败'
          }
        }
        
        return { 
          success: false, 
          message
        }
      }
    },
    
    async getFacilityFeedbacks({ commit }, facilityId) {
      commit('SET_LOADING', true)
      try {
        const response = await api.get(`/feedback/facility/${facilityId}`)
        commit('SET_FACILITY_FEEDBACKS', response.data)
        return response.data
      } catch (error) {
        console.error('获取设施评价失败:', error)
        return []
      } finally {
        commit('SET_LOADING', false)
      }
    },
    
    async getCommunityFeedbacks({ commit }, locationId) {
      commit('SET_LOADING', true)
      try {
        const response = await api.get(`/feedback/community/${locationId}`)
        commit('SET_COMMUNITY_FEEDBACKS', response.data)
        return response.data
      } catch (error) {
        console.error('获取社区评价失败:', error)
        return []
      } finally {
        commit('SET_LOADING', false)
      }
    }
  },
  getters: {
    communityFeedbacksByLocation: state => locationId => {
      return state.communityFeedbacks.filter(f => f.location_id === locationId)
    },
    
    facilityFeedbacksByFacility: state => facilityId => {
      return state.facilityFeedbacks.filter(f => f.facility_id === facilityId)
    }
  }
}
