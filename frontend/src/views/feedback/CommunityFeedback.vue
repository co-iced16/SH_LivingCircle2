<template>
  <div class="community-feedback-container">
    <div class="page-header">
      <h1>社区生活圈评价</h1>
      <p>请对您所在的社区生活圈的整体便利性进行评价</p>
      
      <!-- 登录状态提示 -->
      <div v-if="!store.state.auth.isAuthenticated" class="login-notice">
        <el-alert
          title="提示：需要登录才能提交评价"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #default>
            <span>您当前未登录，请先</span>
            <el-button type="primary" text @click="router.push('/login')">点击登录</el-button>
            <span>后再提交评价。测试账号：demo / 123456</span>
          </template>
        </el-alert>
      </div>
    </div>

    <div class="card-container">
      <el-form
        ref="feedbackFormRef"
        :model="feedbackForm"
        :rules="feedbackRules"
        label-width="120px"
      >
        <!-- 位置选择 -->
        <div class="section-title">选择评价位置</div>
        
        <el-form-item label="定位方式">
          <el-radio-group v-model="locationType" @change="handleLocationTypeChange">
            <el-radio label="current">当前位置</el-radio>
            <el-radio label="coordinates">输入坐标</el-radio>
            <el-radio label="search">搜索地址</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <!-- 当前位置 -->
        <div v-if="locationType === 'current'">
          <el-form-item>
            <el-button @click="getCurrentLocation" :loading="locationLoading">
              <el-icon><Location /></el-icon>
              获取当前位置
            </el-button>
          </el-form-item>
          
          <!-- 位置信息显示区域 -->
          <div v-if="feedbackForm.longitude && feedbackForm.latitude" class="location-info">
            <el-card shadow="never" class="location-card">
              <template #header>
                <div class="location-header">
                  <el-icon><LocationInformation /></el-icon>
                  <span>定位信息</span>
                </div>
              </template>
              
                <div class="location-details">
                  <div class="location-row">
                    <span class="label">经度:</span>
                    <span class="value">{{ feedbackForm.longitude != null ? feedbackForm.longitude.toFixed(6) : '-' }}</span>
                  </div>
                  <div class="location-row">
                    <span class="label">纬度:</span>
                    <span class="value">{{ feedbackForm.latitude != null ? feedbackForm.latitude.toFixed(6) : '-' }}</span>
                  </div>
                  <div class="location-row" v-if="feedbackForm.formatted_address">
                    <span class="label">详细地址:</span>
                    <span class="value">{{ feedbackForm.formatted_address }}</span>
                  </div>
                  <div class="location-row" v-if="locationDetails.province">
                    <span class="label">省份:</span>
                    <span class="value">{{ locationDetails.province }}</span>
                  </div>
                  <div class="location-row" v-if="locationDetails.district">
                    <span class="label">区域:</span>
                    <span class="value">{{ locationDetails.district }}</span>
                  </div>
                  <div class="location-row" v-if="locationDetails.township">
                    <span class="label">街道:</span>
                    <span class="value">{{ locationDetails.township }}</span>
                  </div>
                  <div class="location-row" v-if="locationAccuracy">
                    <span class="label">定位精度:</span>
                    <span class="value">{{ locationAccuracy }}米</span>
                  </div>
                </div>              <div class="location-actions">
                <el-button size="small" @click="clearLocation" type="warning">
                  <el-icon><Close /></el-icon>
                  清除位置
                </el-button>
                <el-button size="small" @click="refreshLocation" :loading="locationLoading">
                  <el-icon><Refresh /></el-icon>
                  重新定位
                </el-button>
              </div>
            </el-card>
          </div>
        </div>
        
        <!-- 坐标输入 -->
        <div v-else-if="locationType === 'coordinates'">
          <el-form-item label="经度" prop="longitude">
            <el-input
              v-model.number="feedbackForm.longitude"
              placeholder="请输入经度"
              @blur="handleCoordinateChange"
            />
          </el-form-item>
          <el-form-item label="纬度" prop="latitude">
            <el-input
              v-model.number="feedbackForm.latitude"
              placeholder="请输入纬度"
              @blur="handleCoordinateChange"
            />
          </el-form-item>
        </div>
        
        <!-- 地址搜索 -->
        <div v-else-if="locationType === 'search'">
          <el-form-item label="搜索地址">
            <el-autocomplete
              v-model="searchAddress"
              :fetch-suggestions="selectedLocation ? () => [] : fetchAddressSuggestions"
              placeholder="请输入地址关键词"
              clearable
              style="width: 100%"
              :debounce="500"
              @select="selectAddress"
              value-key="address"
              :loading="searchLoading"
              :disabled="!!selectedLocation"
            >
              <template #default="{ item }">
                <div class="address-suggestion">
                  <div class="address-name">{{ item.name }}</div>
                  <div class="address-detail">{{ item.address }}</div>
                  <div class="address-info">{{ item.district }} · {{ item.type }}</div>
                </div>
              </template>
              <template #append>
                <el-button @click="searchLocation" :loading="searchLoading" :disabled="!!selectedLocation">
                  <el-icon><Search /></el-icon>
                  搜索
                </el-button>
              </template>
            </el-autocomplete>
          </el-form-item>
          
          <!-- 搜索选择的位置信息显示区域 -->
          <div v-if="selectedLocation && feedbackForm.longitude != null && feedbackForm.latitude != null" class="location-info">
            <el-card shadow="never" class="location-card">
              <template #header>
                <div class="location-header">
                  <el-icon><LocationInformation /></el-icon>
                  <span>已选择位置</span>
                </div>
              </template>
              
              <div class="location-details">
                <div class="location-row">
                  <span class="label">经度:</span>
                  <span class="value">{{ feedbackForm.longitude != null ? feedbackForm.longitude.toFixed(6) : '-' }}</span>
                  </div>
                  <div class="location-row">
                    <span class="label">纬度:</span>
                  <span class="value">{{ feedbackForm.latitude != null ? feedbackForm.latitude.toFixed(6) : '-' }}</span>
                </div>
                <div class="location-row" v-if="feedbackForm.formatted_address">
                  <span class="label">详细地址:</span>
                  <span class="value">{{ feedbackForm.formatted_address }}</span>
                </div>
                <div class="location-row" v-if="selectedLocation.province">
                  <span class="label">省份:</span>
                  <span class="value">{{ selectedLocation.province }}</span>
                </div>
                <div class="location-row" v-if="selectedLocation.district">
                  <span class="label">区域:</span>
                  <span class="value">{{ selectedLocation.district }}</span>
                </div>
                <div class="location-row" v-if="selectedLocation.township">
                  <span class="label">街道:</span>
                  <span class="value">{{ selectedLocation.township }}</span>
                </div>
                <div class="location-row" v-if="selectedLocation.citycode">
                  <span class="label">城市代码:</span>
                  <span class="value">{{ selectedLocation.citycode }}</span>
                </div>
                <div class="location-row" v-if="selectedLocation.adcode">
                  <span class="label">行政区代码:</span>
                  <span class="value">{{ selectedLocation.adcode }}</span>
                </div>
              </div>
              
              <div class="location-actions">
                <el-button size="small" @click="clearSearchLocation" type="warning">
                  <el-icon><Close /></el-icon>
                  重新搜索
                </el-button>
              </div>
            </el-card>
          </div>
          
          <!-- 搜索结果（仅在没有选择地址时显示） -->
          <div v-if="!selectedLocation && searchResults.length > 0" class="search-results">
            <div
              v-for="result in searchResults"
              :key="result.id"
              class="search-result-item"
              :class="{ 'selected': selectedSearchResult?.id === result.id }"
              @click="selectSearchResult(result)"
            >
              <div class="result-name">{{ result.name }}</div>
              <div class="result-address">{{ result.address }}</div>
            </div>
          </div>
        </div>
        
        <!-- 地图显示 -->
        <div v-if="showMap" class="map-container" ref="mapContainer"></div>
        
        <!-- 评价信息 -->
        <div class="section-title" style="margin-top: 32px;">评价信息</div>
        
        <el-form-item label="居民类型">
          <el-select v-model="feedbackForm.residentType" placeholder="请选择您的居民类型（可选）">
            <el-option label="业主" value="owner" />
            <el-option label="租户" value="tenant" />
            <el-option label="访客" value="visitor" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="便利度评分" prop="score">
          <el-rate
            v-model="feedbackForm.score"
            :max="5"
            show-text
            :texts="['很不便利', '不太便利', '一般便利', '比较便利', '非常便利']"
          />
        </el-form-item>
        
        <el-form-item label="详细评价" prop="content">
          <el-input
            v-model="feedbackForm.content"
            type="textarea"
            :rows="6"
            placeholder="请详细描述您对该社区生活圈便利性的看法，包括交通、购物、医疗、教育等方面..."
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submitFeedback" :loading="submitLoading">
            提交评价
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AmapUtils } from '@/utils/map'
import { locationAPI } from '@/utils/api'

export default {
  name: 'CommunityFeedback',
  setup() {
    const store = useStore()
    const router = useRouter()
    const feedbackFormRef = ref()
    const mapContainer = ref()
    
    const locationType = ref('current')
    const locationLoading = ref(false)
    const searchLoading = ref(false)
    const submitLoading = ref(false)
    const showMap = ref(false)
    
    const searchAddress = ref('')
    const searchResults = ref([])
    const selectedSearchResult = ref(null)
    const selectedLocation = ref(null)
    
    // 定位精度信息
    const locationAccuracy = ref(null)
    
    // 详细位置信息
    const locationDetails = reactive({
      province: '',
      city: '',
      district: '',
      township: '',
      neighborhood: '',
      building: ''
    })
    
    const feedbackForm = reactive({
      longitude: null,
      latitude: null,
      formatted_address: '',
      residentType: '',
      score: null,
      content: ''
    })
    
    const feedbackRules = {
      score: [
        { required: true, message: '请选择便利度评分', trigger: 'change' }
      ],
      content: [
        { required: true, message: '请填写详细评价', trigger: 'blur' },
        { min: 10, message: '评价内容至少10个字符', trigger: 'blur' }
      ]
    }
    
    let map = null
    let marker = null
    
    // 初始化地图
    const initMap = async () => {
      await nextTick()
      if (!mapContainer.value) return
      
      map = AmapUtils.initMap(mapContainer.value, {
        zoom: 15,
        center: [121.473701, 31.230416]
      })
      
      // 地图点击事件
      map.on('click', (e) => {
        const { lng, lat } = e.lnglat
        updateLocation(lng, lat)
      })
    }
    
    // 获取当前位置
    const getCurrentLocation = async () => {
      locationLoading.value = true
      try {
        console.log('开始获取当前位置...')
        
        // 检查是否支持地理定位
        if (!navigator.geolocation) {
          throw new Error('浏览器不支持地理定位')
        }
        
        // 检查AMap是否已加载
        if (typeof AMap === 'undefined') {
          ElMessage.error('地图组件加载中，请稍后再试')
          return
        }
        
        const position = await AmapUtils.getCurrentPosition()
        console.log('定位成功:', position)
        
        // 保存定位精度信息
        locationAccuracy.value = position.accuracy ? Math.round(position.accuracy) : null
        
        // 更新前端显示
        feedbackForm.longitude = position.longitude
        feedbackForm.latitude = position.latitude
        
        // 调用后端API进行反编码获取详细地理位置信息
        try {
          const geocodeResult = await locationAPI.reverseGeocode(position.longitude, position.latitude)
          
          if (geocodeResult.success) {
            const data = geocodeResult.data
            feedbackForm.formatted_address = data.formatted_address
            
            // 更新详细位置信息
            locationDetails.province = data.province || ''
            locationDetails.city = data.city || ''
            locationDetails.district = data.district || ''
            locationDetails.township = data.township || ''
            locationDetails.neighborhood = data.neighborhood || ''
            locationDetails.building = data.building || ''
            
            console.log('高德API反编码成功:', data)
          } else {
            // 如果后端反编码失败，使用前端获取的地址
            feedbackForm.formatted_address = position.formatted_address || `${position.longitude}, ${position.latitude}`
            console.warn('后端反编码失败，使用前端地址:', feedbackForm.formatted_address)
          }
        } catch (geocodeError) {
          console.warn('调用反编码API失败:', geocodeError)
          feedbackForm.formatted_address = position.formatted_address || `${position.longitude}, ${position.latitude}`
        }
        
        // 保存到后端数据库
        try {
          const saveResult = await locationAPI.saveLocation({
            longitude: position.longitude,
            latitude: position.latitude,
            formatted_address: feedbackForm.formatted_address,
            district_code: locationDetails.district
          })
          
          if (saveResult.success) {
            feedbackForm.location_id = saveResult.data.location_id
            console.log('位置信息保存成功:', saveResult.data)
          }
        } catch (saveError) {
          console.warn('位置信息保存失败，但不影响使用:', saveError)
        }
        
        // 更新地图标记
        if (map) {
          updateMapMarker(position.longitude, position.latitude)
        }
        
        ElMessage.success('定位成功')
      } catch (error) {
        console.error('定位失败:', error)
        ElMessage.error('定位失败: ' + error.message)
      } finally {
        locationLoading.value = false
      }
    }
    
    // 自动完成地址搜索
    const fetchAddressSuggestions = async (queryString, callback) => {
      if (!queryString || queryString.trim().length < 2) {
        callback([])
        return
      }
      
      try {
        console.log('自动完成搜索:', queryString)
        
        // 使用地址搜索方法
        const results = await AmapUtils.searchAddress(queryString.trim(), {
          city: '上海'
        })
        
        // 转换为自动完成组件需要的格式
        const suggestions = results.map(item => ({
          value: item.address, // 用于显示在输入框中的值
          id: item.id,
          name: item.name,
          address: item.address,
          longitude: item.location.lng,
          latitude: item.location.lat,
          type: item.type,
          district: item.district || '',
          city: item.city || '',
          province: item.province || ''
        }))
        
        console.log('自动完成建议:', suggestions)
        callback(suggestions)
        
      } catch (error) {
        console.error('自动完成搜索失败:', error)
        callback([])
      }
    }
    
    // 清除搜索选择的位置
    const clearSearchLocation = () => {
      selectedLocation.value = null;
      searchAddress.value = '';
      feedbackForm.longitude = null;
      feedbackForm.latitude = null;
      feedbackForm.formatted_address = '';
      locationDetails.province = '';
      locationDetails.district = '';
      locationDetails.township = '';
      ElMessage.success('已清除选择的位置');
    };

    // 选择地址
    const selectAddress = (item) => {
      console.log('选择地址:', item)
      
      // 更新表单数据
      feedbackForm.longitude = item.longitude
      feedbackForm.latitude = item.latitude
      feedbackForm.formatted_address = item.address
      
      // 更新位置详情
      locationDetails.province = item.province || ''
      locationDetails.city = item.city || ''
      locationDetails.district = item.district || ''
      locationDetails.township = item.township || ''
      
      // 保存选中的位置
      selectedLocation.value = {
        name: item.name,
        address: item.address,
        province: item.province,
        city: item.city,
        district: item.district,
        township: item.township,
        citycode: item.citycode,
        adcode: item.adcode,
        location: item.location
      }
      
      // 清空搜索结果
      searchResults.value = []
      
      // 如果有地图，更新地图位置
      if (map && marker) {
        const position = new AMap.LngLat(item.longitude, item.latitude)
        marker.setPosition(position)
        map.setCenter(position)
      }
      
      ElMessage.success(`已选择地址: ${item.address}`)
    }
    
    // 搜索地址
    const searchLocation = async () => {
      if (!searchAddress.value.trim()) {
        ElMessage.warning('请输入搜索关键词')
        return
      }
      
      searchLoading.value = true
      try {
        console.log('开始搜索地址:', searchAddress.value)
        
        // 使用专门的地址搜索方法（优先高德API）
        const results = await AmapUtils.searchAddress(searchAddress.value, {
          city: '上海'
        })
        
        console.log('搜索结果:', results)
        
        searchResults.value = results.map(item => ({
          id: item.id,
          name: item.name,
          address: item.address,
          longitude: item.location.lng,
          latitude: item.location.lat,
          type: item.type,
          district: item.district || '',
          city: item.city || ''
        }))
        
        if (results.length === 0) {
          ElMessage.info('未找到相关地址')
        }
      } catch (error) {
        ElMessage.error('搜索失败: ' + error.message)
      } finally {
        searchLoading.value = false
      }
    }
    
    // 选择搜索结果
    const selectSearchResult = async (result) => {
      selectedSearchResult.value = result
      await updateLocation(result.longitude, result.latitude, result.address)
    }
    
    // 更新地图标记
    const updateMapMarker = (longitude, latitude) => {
      try {
        if (!map) return
        
        // 移动地图中心
        map.setCenter([longitude, latitude])
        
        // 移除旧标记
        if (marker) {
          try {
            map.remove(marker)
          } catch (removeError) {
            console.warn('移除旧标记时出错:', removeError)
          }
        }
        
        // 添加新标记
        marker = AmapUtils.addMarker(map, { longitude, latitude }, {
          title: '选择的位置'
        })
      } catch (error) {
        console.warn('更新地图标记时出错:', error)
      }
    }
    
    // 更新位置信息
    const updateLocation = async (longitude, latitude, address = null) => {
      feedbackForm.longitude = longitude
      feedbackForm.latitude = latitude
      
      try {
        // 如果没有提供地址，进行逆地理编码
        if (!address) {
          console.log('开始逆地理编码...', longitude, latitude)
          const geoResult = await AmapUtils.reverseGeocode(longitude, latitude)
          feedbackForm.formatted_address = geoResult.formatted_address
          console.log('逆地理编码成功:', geoResult.formatted_address)
        } else {
          feedbackForm.formatted_address = address
          console.log('使用提供的地址:', address)
        }
        
        // 显示地图并更新标记
        showMap.value = true
        await nextTick()
        
        if (!map) {
          await initMap()
        }
        
        updateMapMarker(longitude, latitude)
        
      } catch (error) {
        console.error('位置更新失败:', error)
        // 即使逆地理编码失败，也要保留坐标信息
        if (!address) {
          feedbackForm.formatted_address = `${longitude}, ${latitude}`
        }
        // 不要显示错误消息，因为坐标信息是有效的
        console.warn('逆地理编码失败，使用坐标作为地址')
      }
    }
    
    // 处理定位方式变化
    const handleLocationTypeChange = () => {
      clearLocation()
    }
    
    // 处理坐标输入变化
    const handleCoordinateChange = async () => {
      const { longitude, latitude } = feedbackForm
      if (longitude && latitude) {
        await updateLocation(longitude, latitude)
      }
    }
    
    // 清除位置
    const clearLocation = () => {
      try {
        feedbackForm.longitude = null
        feedbackForm.latitude = null
        feedbackForm.formatted_address = ''
        locationAccuracy.value = null
        
        // 清除详细位置信息
        locationDetails.province = ''
        locationDetails.city = ''
        locationDetails.district = ''
        locationDetails.township = ''
        locationDetails.neighborhood = ''
        locationDetails.building = ''
        
        searchResults.value = []
        selectedSearchResult.value = null
        
        // 安全地清理地图标记
        if (marker && map) {
          try {
            map.remove(marker)
            marker = null
          } catch (mapError) {
            console.warn('清理地图标记时出错:', mapError)
            marker = null
          }
        }
      } catch (error) {
        console.warn('清除位置时出错:', error)
      }
    }
    
    // 刷新定位
    const refreshLocation = async () => {
      await getCurrentLocation()
    }
    
    // 提交反馈
    const submitFeedback = async () => {
      if (!feedbackFormRef.value) return
      
      // 防止重复提交
      if (submitLoading.value) {
        return
      }

      // 检查用户是否已登录
      console.log('认证状态检查:', {
        isAuthenticated: store.state.auth.isAuthenticated,
        token: store.state.auth.token ? '有token' : '无token',
        user: store.state.auth.user
      })
      
      if (!store.state.auth.isAuthenticated) {
        ElMessage({
          message: '请先登录后再提交评价',
          type: 'warning',
          duration: 3000,
          showClose: true
        })
        // 跳转到登录页面
        router.push('/login')
        return
      }
      
      try {
        await feedbackFormRef.value.validate()
        
        if (!feedbackForm.longitude || !feedbackForm.latitude) {
          ElMessage.warning('请选择评价位置')
          return
        }
        
        submitLoading.value = true
        
        console.log('准备提交反馈，token:', store.state.auth.token ? '存在' : '不存在')
        
        const result = await store.dispatch('feedback/submitCommunityFeedback', {
          longitude: feedbackForm.longitude,
          latitude: feedbackForm.latitude,
          formatted_address: feedbackForm.formatted_address,
          score: feedbackForm.score,
          content: feedbackForm.content,
          resident_type: feedbackForm.residentType
        })
        
        if (result.success) {
          ElMessage.success('评价提交成功')
          resetForm()
        } else {
          console.log('提交失败结果:', result)
          // 如果是权限相关错误，提供登录选项
          if (result.message.includes('登录') || result.message.includes('权限')) {
            ElMessage({
              message: result.message,
              type: 'error',
              duration: 5000,
              showClose: true
            })
            // 3秒后跳转到登录页面
            setTimeout(() => {
              router.push('/login')
            }, 3000)
          } else {
            ElMessage.error(result.message)
          }
        }
      } catch (error) {
        console.error('提交失败:', error)
        ElMessage.error('提交失败，请重试')
      } finally {
        submitLoading.value = false
      }
    }
    
    // 重置表单
    const resetForm = () => {
      try {
        // 先清除位置，避免在重置过程中触发渲染错误
        clearLocation()
        // 延迟重置表单字段，确保位置信息已清除
        nextTick(() => {
          feedbackFormRef.value?.resetFields()
        })
        showMap.value = false
      } catch (error) {
        console.warn('重置表单时出错:', error)
        // 即使出错也要确保位置被清除
        clearLocation()
      }
    }
    
    onMounted(async () => {
      // 初始化时不显示地图，等用户选择位置后再显示
    })
    
    // 组件卸载时清理资源
    onUnmounted(() => {
      try {
        // 清理地图资源
        if (marker && map) {
          map.remove(marker)
          marker = null
        }
        if (map) {
          map.destroy()
          map = null
        }
      } catch (error) {
        console.warn('清理地图资源时出错:', error)
      }
    })
    
    return {
      store,
      router,
      feedbackForm,
      feedbackRules,
      feedbackFormRef,
      mapContainer,
      locationType,
      locationLoading,
      searchLoading,
      submitLoading,
      showMap,
      searchAddress,
      searchResults,
      selectedSearchResult,
      selectedLocation,
      locationAccuracy,
      locationDetails,
      getCurrentLocation,
      refreshLocation,
      fetchAddressSuggestions,
      selectAddress,
      searchLocation,
      selectSearchResult,
      handleLocationTypeChange,
      handleCoordinateChange,
      clearLocation,
      clearSearchLocation,
      submitFeedback,
      resetForm
    }
  }
}
</script>

<style scoped>
.community-feedback-container {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 8px;
}

.page-header p {
  color: #909399;
  font-size: 16px;
  margin: 0 0 16px;
}

.login-notice,
.user-info {
  margin: 16px 0;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.search-results {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 8px;
}

.search-result-item {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  transition: background-color 0.3s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover,
.search-result-item.selected {
  background-color: #ecf5ff;
}

.result-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.result-address {
  font-size: 12px;
  color: #909399;
}

/* 自动完成地址建议样式 */
.address-suggestion {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.address-suggestion:last-child {
  border-bottom: none;
}

.address-name {
  font-weight: 500;
  color: #303133;
  font-size: 14px;
  margin-bottom: 4px;
}

.address-detail {
  color: #606266;
  font-size: 13px;
  margin-bottom: 2px;
  line-height: 1.4;
}

.address-info {
  color: #909399;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-address {
  margin-top: 12px;
}

.selected-address .el-alert {
  border-radius: 6px;
}

.location-info {
  margin-top: 16px;
}

.location-card {
  border: 1px solid #e4e7ed;
}

.location-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
  font-weight: 500;
}

.location-details {
  margin: 16px 0;
}

.location-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.location-row:last-child {
  margin-bottom: 0;
}

.location-row .label {
  font-weight: 500;
  color: #606266;
  min-width: 60px;
}

.location-row .value {
  color: #303133;
  font-family: 'Monaco', 'Menlo', monospace;
  flex: 1;
  text-align: right;
}

.location-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

@media (max-width: 768px) {
  .community-feedback-container {
    margin: 0 16px;
  }
  
  .page-header h1 {
    font-size: 22px;
  }
  
  .page-header p {
    font-size: 14px;
  }
  
  .location-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .location-row .value {
    text-align: left;
  }
  
  .location-actions {
    flex-direction: column;
  }
}
</style>
