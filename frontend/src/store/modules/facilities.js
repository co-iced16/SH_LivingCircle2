import api from '@/utils/api'

export default {
  namespaced: true,
  state: {
    categories: [],
    facilities: [],
    loading: false
  },
  mutations: {
    SET_CATEGORIES(state, categories) {
      state.categories = categories
    },
    SET_FACILITIES(state, facilities) {
      state.facilities = facilities
    },
    SET_LOADING(state, loading) {
      state.loading = loading
    }
  },
  actions: {
    async fetchCategories({ commit }) {
      commit('SET_LOADING', true)
      try {
        const response = await api.get('/facilities/categories')
        commit('SET_CATEGORIES', response.data)
      } catch (error) {
        console.error('获取设施分类失败:', error)
      } finally {
        commit('SET_LOADING', false)
      }
    },
    
    async searchFacilities({ commit }, params) {
      commit('SET_LOADING', true)
      try {
        const response = await api.get('/facilities/search', { params })
        const facilities = response.data.facilities || []
        commit('SET_FACILITIES', facilities)
        return facilities
      } catch (error) {
        console.error('搜索设施失败:', error)
        return []
      } finally {
        commit('SET_LOADING', false)
      }
    },
    
    async searchMapFacilities(_, params) {
      try {
        const response = await api.get('/facilities/map-search', { params })
        return response.data.facilities || []
      } catch (error) {
        console.error('地图搜索设施失败:', error)
        return []
      }
    },
    
    async getFacilityDetail(_, facilityId) {
      try {
        const response = await api.get(`/facilities/${facilityId}`)
        return response.data
      } catch (error) {
        console.error('获取设施详情失败:', error)
        return null
      }
    }
  },
  getters: {
    categoriesTree: state => {
      // 将扁平的分类数据转换为树形结构
      const categories = state.categories
      const tree = []
      const categoryMap = new Map()
      
      // 先创建所有分类节点
      categories.forEach(cat => {
        categoryMap.set(cat.category_code, {
          ...cat,
          children: []
        })
      })
      
      // 构建树形结构
      categories.forEach(cat => {
        const node = categoryMap.get(cat.category_code)
        if (cat.parent_code && categoryMap.has(cat.parent_code)) {
          categoryMap.get(cat.parent_code).children.push(node)
        } else {
          tree.push(node)
        }
      })
      
      return tree
    },
    
    facilitiesByCategory: state => categoryCode => {
      return state.facilities.filter(f => f.category_code === categoryCode)
    }
  }
}
