<template>
  <div class="evaluation-container">
    <div class="page-header">
      <h1>社区生活圈便利度评估</h1>
      <p>科学评估社区生活便利度，为您提供详细的分析报告</p>
    </div>

    <div class="card-container">
      <el-steps :active="currentStep" finish-status="success" style="margin-bottom: 32px;">
        <el-step title="选择位置" />
        <el-step title="设置参数" />
        <el-step title="开始评估" />
        <el-step title="查看结果" />
      </el-steps>
      
      <!-- 第一步：选择位置 -->
      <div v-show="currentStep === 0">
        <div class="section-title">选择评估位置</div>
        
        <el-form label-width="120px">
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
            <div v-if="evaluationForm.longitude && evaluationForm.latitude" class="location-info">
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
                    <span class="value">{{ evaluationForm.longitude.toFixed(6) }}</span>
                  </div>
                  <div class="location-row">
                    <span class="label">纬度:</span>
                    <span class="value">{{ evaluationForm.latitude.toFixed(6) }}</span>
                  </div>
                  <div class="location-row" v-if="evaluationForm.formatted_address">
                    <span class="label">详细地址:</span>
                    <span class="value">{{ evaluationForm.formatted_address }}</span>
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
                </div>
                
                <div class="location-actions">
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
            <el-form-item label="经度">
              <el-input
                v-model.number="evaluationForm.longitude"
                placeholder="请输入经度"
                @blur="handleCoordinateChange"
              />
            </el-form-item>
            <el-form-item label="纬度">
              <el-input
                v-model.number="evaluationForm.latitude"
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
              </el-autocomplete>
            </el-form-item>
            
            <!-- 搜索选择的位置信息显示区域 -->
            <div v-if="selectedLocation" class="location-info">
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
                    <span class="value">{{ evaluationForm.longitude.toFixed(6) }}</span>
                  </div>
                  <div class="location-row">
                    <span class="label">纬度:</span>
                    <span class="value">{{ evaluationForm.latitude.toFixed(6) }}</span>
                  </div>
                  <div class="location-row" v-if="evaluationForm.formatted_address">
                    <span class="label">详细地址:</span>
                    <span class="value">{{ evaluationForm.formatted_address }}</span>
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
        </el-form>
        
        <!-- 地图显示 -->
        <div v-if="showMap" class="map-container" ref="mapContainer"></div>
        
        <div style="margin-top: 24px;">
          <el-button 
            type="primary" 
            @click="nextStep" 
            :disabled="!evaluationForm.longitude || !evaluationForm.latitude"
          >
            下一步
          </el-button>
        </div>
      </div>
      
      <!-- 第二步：设置参数 -->
      <div v-show="currentStep === 1">
        <div class="section-title">评估参数设置</div>
        
        <el-form label-width="120px">
          <el-form-item label="评估半径">
            <el-slider
              v-model="evaluationForm.radius"
              :min="500"
              :max="5000"
              :step="100"
              show-input
              :show-input-controls="false"
              style="width: 300px;"
            />
            <span style="margin-left: 12px;">米</span>
          </el-form-item>
          
          <el-form-item label="交通方式">
            <el-checkbox-group v-model="evaluationForm.transportModes">
              <el-checkbox label="walking">步行</el-checkbox>
              <el-checkbox label="transit">公交</el-checkbox>
              <el-checkbox label="driving">驾车</el-checkbox>
              <el-checkbox label="cycling">骑行</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          
          <el-form-item label="关注设施">
            <el-tree
              ref="categoryTreeRef"
              :data="facilityCategories"
              :props="treeProps"
              show-checkbox
              node-key="category_code"
              @check="handleCategoryCheck"
              style="max-height: 300px; overflow-y: auto; border: 1px solid #dcdfe6; padding: 12px;"
            />
          </el-form-item>
        </el-form>
        
        <div style="margin-top: 24px;">
          <el-button @click="prevStep">上一步</el-button>
          <el-button 
            type="primary" 
            @click="nextStep"
            :disabled="evaluationForm.transportModes.length === 0 || evaluationForm.selectedCategories.length === 0"
          >
            下一步
          </el-button>
        </div>
      </div>
      
      <!-- 第三步：开始评估 -->
      <div v-show="currentStep === 2">
        <div class="section-title">评估参数确认</div>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="评估位置">
            {{ evaluationForm.formatted_address }}
          </el-descriptions-item>
          <el-descriptions-item label="评估半径">
            {{ evaluationForm.radius }}米
          </el-descriptions-item>
          <el-descriptions-item label="交通方式">
            {{ getTransportModeText(evaluationForm.transportModes) }}
          </el-descriptions-item>
          <el-descriptions-item label="关注设施">
            {{ evaluationForm.selectedCategories.length }}个类别
          </el-descriptions-item>
        </el-descriptions>
        
        <div style="margin-top: 24px;">
          <el-button @click="prevStep">上一步</el-button>
          <el-button 
            type="primary" 
            @click="startEvaluation"
            :loading="evaluationLoading"
          >
            开始评估
          </el-button>
        </div>
      </div>
      
      <!-- 第四步：评估进度 -->
      <div v-show="currentStep === 3">
        <div v-if="evaluationLoading" class="evaluation-progress">
          <div class="progress-content">
            <div class="progress-icon">
              <el-icon size="64" class="rotating"><Loading /></el-icon>
            </div>
            <h3>正在评估中...</h3>
            <p>{{ currentProgress }}</p>
            <el-progress :percentage="progressPercentage" />
          </div>
        </div>
        
        <div v-else-if="evaluationResult" class="evaluation-complete">
          <el-result
            icon="success"
            title="评估完成!"
            sub-title="便利度评估已完成，点击查看详细结果"
          >
            <template #extra>
              <el-button type="primary" @click="viewResult">
                查看评估结果
              </el-button>
              <el-button @click="resetEvaluation">重新评估</el-button>
            </template>
          </el-result>
        </div>
        
        <div v-else class="evaluation-error">
          <el-result
            icon="error"
            title="评估失败"
            sub-title="评估过程中发生了错误，请重试"
          >
            <template #extra>
              <el-button type="primary" @click="startEvaluation">重试</el-button>
              <el-button @click="resetEvaluation">重新开始</el-button>
            </template>
          </el-result>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AmapUtils } from '@/utils/map'
import { locationAPI } from '@/utils/api'

export default {
  name: 'Evaluation',
  setup() {
    const store = useStore()
    const router = useRouter()
    
    const currentStep = ref(0)
    const locationLoading = ref(false)
    const searchLoading = ref(false)
    const evaluationLoading = ref(false)
    const showMap = ref(false)
    
    const locationType = ref('current')
    const searchAddress = ref('')
    const searchResults = ref([])
    const selectedSearchResult = ref(null)
    const selectedLocation = ref(null)
    
    const currentProgress = ref('')
    const progressPercentage = ref(0)
    const evaluationResult = ref(null)
    
    const mapContainer = ref()
    const categoryTreeRef = ref()
    
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

    const evaluationForm = reactive({
      longitude: null,
      latitude: null,
      formatted_address: '',
      radius: 1000,
      transportModes: ['walking'],
      selectedCategories: []
    })
    
    const treeProps = {
      children: 'children',
      label: 'category_name'
    }
    
    let map = null
    let marker = null
    let circle = null
    
    const facilityCategories = computed(() => store.getters['facilities/categoriesTree'])
    
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
        evaluationForm.longitude = position.longitude
        evaluationForm.latitude = position.latitude
        
        // 调用后端API进行反编码获取详细地理位置信息
        try {
          const geocodeResult = await locationAPI.reverseGeocode(position.longitude, position.latitude)
          
          if (geocodeResult.success) {
            const data = geocodeResult.data
            evaluationForm.formatted_address = data.formatted_address
            
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
            evaluationForm.formatted_address = position.formatted_address || `${position.longitude}, ${position.latitude}`
            console.warn('后端反编码失败，使用前端地址:', evaluationForm.formatted_address)
          }
        } catch (geocodeError) {
          console.warn('调用反编码API失败:', geocodeError)
          evaluationForm.formatted_address = position.formatted_address || `${position.longitude}, ${position.latitude}`
        }
        
        // 保存到后端数据库
        try {
          const saveResult = await locationAPI.saveLocation({
            longitude: position.longitude,
            latitude: position.latitude,
            formatted_address: evaluationForm.formatted_address,
            district_code: locationDetails.district
          })
          
          if (saveResult.success) {
            evaluationForm.location_id = saveResult.data.location_id
            console.log('位置信息保存成功:', saveResult.data)
          }
        } catch (saveError) {
          console.warn('位置信息保存失败，但不影响使用:', saveError)
        }
        
        ElMessage.success('定位成功')
      } catch (error) {
        console.error('定位失败:', error)
        ElMessage.error('定位失败: ' + error.message)
      } finally {
        locationLoading.value = false
      }
    }
    
    // 清除搜索选择的位置
    const clearSearchLocation = () => {
      selectedLocation.value = null;
      searchAddress.value = '';
      evaluationForm.longitude = null;
      evaluationForm.latitude = null;
      evaluationForm.formatted_address = '';
      locationDetails.province = '';
      locationDetails.district = '';
      locationDetails.township = '';
      ElMessage.success('已清除选择的位置');
    };

    // 自动完成地址搜索
    const fetchAddressSuggestions = async (queryString, cb) => {
      if (!queryString || queryString.trim().length < 2) {
        cb([]);
        return;
      }

      try {
        console.log('开始获取地址建议:', queryString);
        
        // 使用地址搜索方法
        const results = await AmapUtils.searchAddress(queryString, {
          city: '上海'
        });

        if (results && results.length > 0) {
          const suggestions = results.map((item, index) => ({
            id: item.id || `suggestion_${index}`,
            name: item.name,
            address: item.address,
            location: `${item.location.lng},${item.location.lat}`,
            longitude: item.location.lng,
            latitude: item.location.lat,
            province: item.province,
            city: item.city,
            district: item.district,
            township: item.township,
            citycode: item.citycode,
            adcode: item.adcode,
            type: item.type
          }));
          
          console.log('地址建议获取成功:', suggestions);
          cb(suggestions);
        } else {
          console.log('未找到地址建议');
          cb([]);
        }
      } catch (error) {
        console.error('获取地址建议失败:', error);
        cb([]);
      }
    };

    // 选择地址
    const selectAddress = (item) => {
      console.log('选择地址:', item)
      
      // 更新表单数据
      evaluationForm.longitude = item.longitude
      evaluationForm.latitude = item.latitude
      evaluationForm.formatted_address = item.address
      
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
        const results = await AmapUtils.searchPOI(searchAddress.value, {
          city: '上海'
        })
        
        searchResults.value = results.map(poi => ({
          id: poi.id,
          name: poi.name,
          address: poi.address,
          longitude: poi.location.lng,
          latitude: poi.location.lat
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
    
    // 更新位置信息
    const updateLocation = async (longitude, latitude, address = null) => {
      evaluationForm.longitude = longitude
      evaluationForm.latitude = latitude
      
      try {
        if (!address) {
          console.log('开始逆地理编码...', longitude, latitude)
          const geoResult = await AmapUtils.reverseGeocode(longitude, latitude)
          evaluationForm.formatted_address = geoResult.formatted_address
          console.log('逆地理编码成功:', geoResult.formatted_address)
        } else {
          evaluationForm.formatted_address = address
          console.log('使用提供的地址:', address)
        }
        
        showMap.value = true
        await nextTick()
        
        if (!map) {
          await initMap()
        }
        
        updateMapDisplay()
        
      } catch (error) {
        console.error('位置更新失败:', error)
        // 即使逆地理编码失败，也要保留坐标信息
        if (!address) {
          evaluationForm.formatted_address = `${longitude}, ${latitude}`
        }
        // 不要显示错误消息，因为坐标信息是有效的
        console.warn('逆地理编码失败，使用坐标作为地址')
      }
    }
    
    // 初始化地图
    const initMap = async () => {
      await nextTick()
      if (!mapContainer.value) return
      
      map = AmapUtils.initMap(mapContainer.value, {
        zoom: 15
      })
      
      map.on('click', (e) => {
        const { lng, lat } = e.lnglat
        updateLocation(lng, lat)
      })
    }
    
    // 更新地图显示
    const updateMapDisplay = () => {
      if (!map) return
      
      const { longitude, latitude, radius } = evaluationForm
      
      // 设置中心点
      map.setCenter([longitude, latitude])
      
      // 清除旧的标记和圆圈
      if (marker) map.remove(marker)
      if (circle) map.remove(circle)
      
      // 添加标记
      marker = AmapUtils.addMarker(map, { longitude, latitude }, {
        title: '评估中心点'
      })
      
      // 添加评估范围圆圈
      circle = AmapUtils.addCircle(map, { longitude, latitude }, radius)
    }
    
    // 处理分类选择
    const handleCategoryCheck = (nodeData, checkInfo) => {
      const checkedKeys = categoryTreeRef.value.getCheckedKeys()
      evaluationForm.selectedCategories = checkedKeys
    }
    
    // 获取交通方式文本
    const getTransportModeText = (modes) => {
      const modeMap = {
        walking: '步行',
        transit: '公交',
        driving: '驾车',
        cycling: '骑行'
      }
      return modes.map(mode => modeMap[mode]).join('、')
    }
    
    // 处理定位方式变化
    const handleLocationTypeChange = () => {
      clearLocation()
    }
    
    // 处理坐标输入变化
    const handleCoordinateChange = async () => {
      const { longitude, latitude } = evaluationForm
      if (longitude && latitude) {
        await updateLocation(longitude, latitude)
      }
    }
    
    // 清除位置
    const clearLocation = () => {
      try {
        evaluationForm.longitude = null
        evaluationForm.latitude = null
        evaluationForm.formatted_address = ''
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
        
        // 安全地清理地图元素
        try {
          if (marker && map) map.remove(marker)
          if (circle && map) map.remove(circle)
          marker = null
          circle = null
        } catch (mapError) {
          console.warn('清理地图元素时出错:', mapError)
          marker = null
          circle = null
        }
      } catch (error) {
        console.warn('清除位置时出错:', error)
      }
    }
    
    // 刷新定位
    const refreshLocation = async () => {
      await getCurrentLocation()
    }
    
    // 下一步
    const nextStep = () => {
      if (currentStep.value < 3) {
        currentStep.value++
        
        // 如果进入参数设置步骤，更新地图显示
        if (currentStep.value === 1) {
          nextTick(() => {
            updateMapDisplay()
          })
        }
      }
    }
    
    // 上一步
    const prevStep = () => {
      if (currentStep.value > 0) {
        currentStep.value--
      }
    }
    
    // 开始评估
    const startEvaluation = async () => {
      evaluationLoading.value = true
      currentStep.value = 3
      progressPercentage.value = 0
      
      try {
        // 模拟评估过程
        const steps = [
          '正在获取设施数据...',
          '正在计算交通时间...',
          '正在分析用户反馈...',
          '正在计算便利度评分...',
          '正在生成评估报告...'
        ]
        
        for (let i = 0; i < steps.length; i++) {
          currentProgress.value = steps[i]
          progressPercentage.value = ((i + 1) / steps.length) * 100
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        // 创建评估任务
        // 将前端的交通方式映射为数据库期望的值
        const transportModeMapping = {
          'walking': 'walk',
          'transit': 'bus', 
          'driving': 'car',
          'cycling': 'ride'
        };
        
        const mappedTransportModes = evaluationForm.transportModes.map(mode => 
          transportModeMapping[mode] || mode
        );
        
        const taskData = {
          formatted_address: evaluationForm.formatted_address,
          longitude: evaluationForm.longitude,
          latitude: evaluationForm.latitude,
          district_code: locationDetails.district,
          radius: evaluationForm.radius,
          transport_modes: mappedTransportModes,
          target_categories: evaluationForm.selectedCategories
        }
        
        console.log('准备发送的评估任务数据:', taskData)
        console.log('详细字段检查:', {
          formatted_address: taskData.formatted_address,
          longitude: taskData.longitude,
          latitude: taskData.latitude,
          district_code: taskData.district_code,
          radius: taskData.radius,
          transport_modes: taskData.transport_modes,
          transport_modes_detail: JSON.stringify(taskData.transport_modes),
          transport_modes_original: JSON.stringify(evaluationForm.transportModes),
          target_categories: taskData.target_categories,
          target_categories_detail: JSON.stringify(taskData.target_categories),
          target_categories_length: taskData.target_categories?.length || 0,
          target_categories_sample: taskData.target_categories?.[0] || 'none'
        })
        
        const result = await store.dispatch('evaluation/createEvaluationTask', taskData)
        
        if (result.success) {
          evaluationResult.value = result.task
          ElMessage.success('评估完成')
        } else {
          throw new Error(result.message)
        }
      } catch (error) {
        ElMessage.error('评估失败: ' + error.message)
        evaluationResult.value = null
      } finally {
        evaluationLoading.value = false
      }
    }
    
    // 查看结果
    const viewResult = () => {
      if (evaluationResult.value) {
        router.push(`/evaluation/result/${evaluationResult.value.task_id}`)
      }
    }
    
    // 重置评估
    const resetEvaluation = () => {
      currentStep.value = 0
      evaluationResult.value = null
      progressPercentage.value = 0
      currentProgress.value = ''
      clearLocation()
    }
    
    onMounted(() => {
      store.dispatch('facilities/fetchCategories')
    })
    
    // 组件卸载时清理资源
    onUnmounted(() => {
      try {
        // 清理地图资源
        if (marker && map) {
          map.remove(marker)
          marker = null
        }
        if (circle && map) {
          map.remove(circle)
          circle = null
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
      currentStep,
      locationType,
      locationLoading,
      searchLoading,
      evaluationLoading,
      showMap,
      searchAddress,
      searchResults,
      selectedSearchResult,
      selectedLocation,
      currentProgress,
      progressPercentage,
      evaluationResult,
      mapContainer,
      categoryTreeRef,
      evaluationForm,
      treeProps,
      facilityCategories,
      getCurrentLocation,
      fetchAddressSuggestions,
      selectAddress,
      searchLocation,
      selectSearchResult,
      handleLocationTypeChange,
      handleCoordinateChange,
      handleCategoryCheck,
      getTransportModeText,
      nextStep,
      prevStep,
      startEvaluation,
      viewResult,
      resetEvaluation,
      clearLocation,
      clearSearchLocation,
      locationAccuracy,
      locationDetails,
      refreshLocation
    }
  }
}
</script>

<style scoped>
.evaluation-container {
  max-width: 1000px;
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
  margin: 0;
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

.evaluation-progress {
  text-align: center;
  padding: 40px 20px;
}

.progress-content {
  max-width: 400px;
  margin: 0 auto;
}

.progress-icon {
  margin-bottom: 24px;
  color: #409EFF;
}

.rotating {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.progress-content h3 {
  font-size: 20px;
  color: #303133;
  margin: 0 0 12px;
}

.progress-content p {
  color: #909399;
  margin: 0 0 24px;
}

.evaluation-complete,
.evaluation-error {
  padding: 40px 20px;
}

@media (max-width: 768px) {
  .evaluation-container {
    margin: 0 16px;
  }
  
  .page-header h1 {
    font-size: 22px;
  }
  
  .page-header p {
    font-size: 14px;
  }
}

/* 位置信息卡片样式 */
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
  .location-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .location-row .value {
    text-align: left;
    font-size: 14px;
  }
  
  .location-actions {
    flex-direction: column;
  }
}

/* 地址搜索建议样式 */
.address-suggestion {
  padding: 8px 0;
}

.address-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  font-size: 14px;
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
  gap: 4px;
}
</style>
