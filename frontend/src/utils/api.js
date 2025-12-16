import axios from 'axios'
import store from '@/store'
import { ElMessage } from 'element-plus'

// 创建axios实例
const api = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = store.state.auth.token
    console.log('API请求拦截器 - Token状态:', token ? '存在' : '不存在')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('API请求拦截器 - 已添加Authorization header')
    } else {
      console.log('API请求拦截器 - 未添加Authorization header，因为token不存在')
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 直接返回后端的响应数据
    return response.data
  },
  error => {
    const { response } = error
    
    if (response) {
      switch (response.status) {
        case 401:
          // 只登出，不显示消息
          store.dispatch('auth/logout')
          break
        case 403:
          // 对于403错误，也只登出，不显示消息
          store.dispatch('auth/logout')
          break
        case 404:
          // 只处理404和500，其他错误让组件处理
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          // 其他错误不在这里处理，让组件自己决定如何显示
          break
      }
    } else {
      ElMessage.error('网络连接失败')
    }
    
    return Promise.reject(error)
  }
)

export default api

/**
 * 地图和位置相关API
 */
export const locationAPI = {
  // 保存位置信息
  saveLocation: async (locationData) => {
    return await api.post('/map/location', locationData)
  },

  // 根据ID获取位置信息
  getLocation: async (locationId) => {
    return await api.get(`/map/location/${locationId}`)
  },

  // 根据坐标查找位置
  findLocationByCoords: async (longitude, latitude) => {
    return await api.get('/map/location/find/coords', {
      params: { longitude, latitude }
    })
  },

  // 地理编码 - 地址转坐标
  geocode: async (address) => {
    return await api.get('/map/geocode', {
      params: { address }
    })
  },

  // 逆地理编码 - 坐标转地址
  reverseGeocode: async (longitude, latitude) => {
    return await api.get('/map/reverse-geocode', {
      params: { longitude, latitude }
    })
  }
}
