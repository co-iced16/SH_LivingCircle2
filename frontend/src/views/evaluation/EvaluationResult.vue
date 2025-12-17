<template>
  <div class="evaluation-result-container">
    <div class="page-header">
      <h1>便利度评估结果</h1>
      <p v-if="taskInfo">{{ taskInfo.created_at }} 的评估报告</p>
    </div>

    <div v-if="loading" class="loading-container">
      <el-icon size="50" class="rotating"><Loading /></el-icon>
      <p>正在加载评估结果...</p>
      <p class="loading-detail">{{ loadingMessage }}</p>
    </div>

    <div v-else-if="resultData" class="result-content">
      <!-- 总体评分卡片 -->
      <div class="result-card">
        <div class="score-section">
          <div class="score-display">
            <div class="score-number" :style="{ color: getScoreColor(resultData?.total_score || 0) }">
              {{ Math.round(resultData?.total_score || 0) }}
            </div>
            <div class="score-label">便利度总分</div>
          </div>
          <div class="score-description">
            <h3>{{ getScoreDescription(resultData?.total_score || 0) }}</h3>
            <p>基于 {{ resultData?.facility_count || 0 }} 个设施的综合评估</p>
          </div>
        </div>
        <div class="score-breakdown">
          <el-row :gutter="16">
            <el-col :span="12">
              <div class="breakdown-item">
                <div class="breakdown-label">设施数量</div>
                <div class="breakdown-value">{{ resultData?.facility_score || 0 }}分</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="breakdown-item">
                <div class="breakdown-label">交通便利</div>
                <div class="breakdown-value">{{ resultData?.transport_score || 0 }}分</div>
              </div>
            </el-col>
          </el-row>
        </div>
      </div>

      <!-- 设施分类统计 -->
      <div class="card-container">
        <h2 class="section-title">设施分类统计</h2>
        <div class="category-stats">
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <div class="chart-container">
                <v-chart
                  class="chart"
                  :option="categoryChartOption"
                  autoresize
                />
              </div>
            </el-col>
            <el-col :xs="24" :md="12">
              <div class="category-list">
                <div
                  v-for="category in categoryStats"
                  :key="category.category_code"
                  class="category-item"
                >
                  <div class="category-info">
                    <span class="category-name">{{ category.category_name }}</span>
                    <span class="facility-count">{{ category.count }}个</span>
                  </div>
                  <div class="category-score">
                    <el-progress 
                      :percentage="category.avg_score || 0" 
                      :stroke-width="10"
                      :color="getScoreColor(category.avg_score || 0)"
                    />
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
      </div>

      <!-- 交通时间分析 -->
      <div class="card-container">
        <h2 class="section-title">交通时间分析</h2>
        <div class="transport-analysis">
          <el-tabs v-model="activeTransportMode">
            <el-tab-pane
              v-for="mode in transportModes"
              :key="mode.value"
              :label="mode.label"
              :name="mode.value"
            >
              <div class="transport-content">
                <div class="transport-summary">
                  <el-row :gutter="24">
                    <el-col :span="8">
                      <div class="summary-item">
                        <div class="summary-label">平均时间</div>
                        <div class="summary-value">
                          {{ formatTime(getTransportStats(mode.value).avgTime) }}
                        </div>
                      </div>
                    </el-col>
                    <el-col :span="8">
                      <div class="summary-item">
                        <div class="summary-label">最短时间</div>
                        <div class="summary-value">
                          {{ formatTime(getTransportStats(mode.value).minTime) }}
                        </div>
                      </div>
                    </el-col>
                    <el-col :span="8">
                      <div class="summary-item">
                        <div class="summary-label">15分钟内</div>
                        <div class="summary-value">
                          {{ getTransportStats(mode.value).within15min }}%
                        </div>
                      </div>
                    </el-col>
                  </el-row>
                </div>
                <div class="chart-container">
                  <v-chart
                    class="chart"
                    :option="getTransportChartOption(mode.value)"
                    autoresize
                  />
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 设施详情列表 -->
      <div class="card-container">
        <h2 class="section-title">设施详情</h2>
        <div class="facility-filters">
          <el-row :gutter="16">
            <el-col :span="8">
              <el-select
                v-model="facilityFilter.category"
                placeholder="选择设施类型"
                clearable
                @change="applyFacilityFilter"
              >
                <el-option
                  v-for="category in categoryStats"
                  :key="category.category_code"
                  :label="category.category_name"
                  :value="category.category_code"
                />
              </el-select>
            </el-col>
            <el-col :span="8">
              <el-select
                v-model="facilityFilter.transport"
                placeholder="选择交通方式"
                clearable
                @change="applyFacilityFilter"
              >
                <el-option
                  v-for="mode in transportModes"
                  :key="mode.value"
                  :label="mode.label"
                  :value="mode.value"
                />
              </el-select>
            </el-col>
            <el-col :span="8">
              <el-input
                v-model="facilityFilter.keyword"
                placeholder="搜索设施名称"
                clearable
                @input="applyFacilityFilter"
              />
            </el-col>
          </el-row>
        </div>
        
        <div class="facility-table">
          <el-table :data="filteredFacilities" style="width: 100%">
            <el-table-column prop="name" label="设施名称" min-width="150" />
            <el-table-column prop="category_name" label="类型" width="120" />
            <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
            <el-table-column label="距离" width="100">
              <template #default="{ row }">
                {{ formatDistance(row.distance) }}
              </template>
            </el-table-column>
            <el-table-column label="交通时间" width="200">
              <template #default="{ row }">
                <div class="transport-times">
                  <div
                    v-for="time in row.transport_times"
                    :key="time.mode"
                    class="transport-time-item"
                  >
                    <span class="mode-label">{{ getModeLabel(time.mode) }}</span>
                    <span class="time-value">{{ formatTime(time.time) }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="用户评分" width="120">
              <template #default="{ row }">
                <div v-if="row.average_score">
                  <el-rate :model-value="row.average_score" disabled />
                  <div class="score-detail">
                    {{ row.average_score }}分 ({{ row.feedback_count }}条)
                  </div>
                </div>
                <span v-else class="no-score">暂无评分</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button
                  type="text"
                  size="small"
                  @click="viewFacilityDetail(row)"
                >
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- 建议与改进 -->
      <div class="card-container">
        <h2 class="section-title">建议与改进</h2>
        <div class="suggestions">
          <el-alert
            v-for="suggestion in suggestions"
            :key="suggestion.id"
            :title="suggestion.title"
            :description="suggestion.description"
            :type="suggestion.type"
            style="margin-bottom: 16px;"
            show-icon
          />
        </div>
      </div>
    </div>

    <div v-else class="error-state">
      <el-result
        icon="warning"
        title="加载失败"
        sub-title="无法加载评估结果，请重试"
      >
        <template #extra>
          <el-button type="primary" @click="loadEvaluationResult">重新加载</el-button>
          <el-button @click="$router.push('/evaluation')">返回评估</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { formatTime, formatDistance, getScoreColor, getScoreDescription } from '@/utils/map'

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

export default {
  name: 'EvaluationResult',
  components: {
    VChart
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const store = useStore()
    
    const loading = ref(true)
    const loadingMessage = ref('正在准备评估任务...')
    const resultData = ref(null)
    const taskInfo = ref(null)
    const activeTransportMode = ref('walking')
    
    const facilityFilter = reactive({
      category: '',
      transport: '',
      keyword: ''
    })
    
    // 所有交通方式定义
    const allTransportModes = [
      { value: 'walking', label: '步行', backendValue: 'walk' },
      { value: 'transit', label: '公交', backendValue: 'bus' },
      { value: 'driving', label: '驾车', backendValue: 'car' },
      { value: 'cycling', label: '骑行', backendValue: 'ride' }
    ]
    
    // 根据任务实际选择的交通方式过滤
    const transportModes = computed(() => {
      if (!taskInfo.value?.transport_modes) return allTransportModes
      
      const selectedModes = taskInfo.value.transport_modes
      return allTransportModes.filter(mode => 
        selectedModes.includes(mode.backendValue) || selectedModes.includes(mode.value)
      )
    })
    
    // 计算属性
    const categoryStats = computed(() => {
      if (!resultData.value?.facilities) return []
      
      const stats = {}
      const radius = taskInfo.value?.radius || 1000
      
      resultData.value.facilities.forEach(facility => {
        const code = facility.category_code
        if (!stats[code]) {
          stats[code] = {
            category_code: code,
            category_name: facility.category_name,
            count: 0,
            total_distance: 0,
            min_time: Infinity
          }
        }
        stats[code].count++
        stats[code].total_distance += facility.distance || 0
        // 获取该设施的最短交通时间
        const times = facility.transport_times?.map(t => t.time) || []
        if (times.length > 0) {
          stats[code].min_time = Math.min(stats[code].min_time, ...times)
        }
      })
      
      return Object.values(stats).map(stat => {
        // 计算该类别的便利度得分
        // 设施密度得分(40%) + 可达性得分(35%) + 默认反馈得分(25%)
        const densityScore = Math.min((stat.count / 10) * 100, 100)
        const avgDist = stat.count > 0 ? stat.total_distance / stat.count : radius
        const accessScore = Math.max(100 - (avgDist / radius) * 50, 50)
        const feedbackScore = 90 // 默认分
        const categoryScore = densityScore * 0.4 + accessScore * 0.35 + feedbackScore * 0.25
        
        return {
          ...stat,
          avg_score: Math.round(categoryScore)
        }
      })
    })
    
    const filteredFacilities = computed(() => {
      if (!resultData.value?.facilities) return []
      
      let facilities = resultData.value.facilities
      
      if (facilityFilter.category) {
        facilities = facilities.filter(f => f.category_code === facilityFilter.category)
      }
      
      if (facilityFilter.transport) {
        facilities = facilities.filter(f => 
          f.transport_times.some(t => t.mode === facilityFilter.transport)
        )
      }
      
      if (facilityFilter.keyword) {
        const keyword = facilityFilter.keyword.toLowerCase()
        facilities = facilities.filter(f => 
          f.name.toLowerCase().includes(keyword) ||
          f.address.toLowerCase().includes(keyword)
        )
      }
      
      return facilities
    })
    
    const categoryChartOption = computed(() => {
      const data = categoryStats.value.map(item => ({
        name: item.category_name,
        value: item.count
      }))
      
      return {
        title: {
          text: '设施分布',
          left: 'center'
        },
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)'
        },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'middle'
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      }
    })
    
    const suggestions = computed(() => {
      const suggestions = []
      
      if (resultData.value?.total_score < 60) {
        suggestions.push({
          id: 1,
          title: '整体便利度较低',
          description: '建议增加基础设施配置，特别是日常生活必需的商店和服务设施',
          type: 'warning'
        })
      }
      
      if (categoryStats.value.some(cat => cat.count === 0)) {
        suggestions.push({
          id: 2,
          title: '设施类型不完整',
          description: '部分设施类型缺失，建议补充相关服务设施',
          type: 'info'
        })
      }
      
      const avgTransportTime = getTransportStats('walking').avgTime
      if (avgTransportTime > 900) { // 15分钟
        suggestions.push({
          id: 3,
          title: '交通时间较长',
          description: '步行到达设施平均时间超过15分钟，建议改善交通设施或增加就近服务点',
          type: 'warning'
        })
      }
      
      if (suggestions.length === 0) {
        suggestions.push({
          id: 4,
          title: '便利度表现良好',
          description: '该区域设施配置较为完善，居民生活便利度较高',
          type: 'success'
        })
      }
      
      return suggestions
    })
    
    // 方法
    const loadEvaluationResult = async () => {
      const taskId = route.params.taskId
      if (!taskId) {
        ElMessage.error('无效的任务ID')
        router.push('/evaluation')
        return
      }
      
      loading.value = true
      loadingMessage.value = '正在启动评估计算...'
      
      // 轮询检查任务是否完成
      const maxRetries = 30 // 最多等待30次，每次2秒，总共1分钟
      let retryCount = 0
      
      while (retryCount < maxRetries) {
        try {
          // 更新加载消息
          if (retryCount === 0) {
            loadingMessage.value = '正在计算便利度评分...'
          } else if (retryCount < 5) {
            loadingMessage.value = '正在分析周边设施...'
          } else if (retryCount < 10) {
            loadingMessage.value = '正在规划出行路线...'
          } else if (retryCount < 15) {
            loadingMessage.value = '正在汇总评估数据...'
          } else {
            loadingMessage.value = `正在完成最后计算... (${retryCount}/${maxRetries})`
          }
          
          const response = await store.dispatch('evaluation/getEvaluationResult', taskId)
          console.log('API响应:', response) // 调试日志
          
          // 检查响应结构 - 处理两种可能的格式
          let result;
          if (response && response.success && response.data) {
            // 标准格式: {success: true, data: {...}}
            result = response.data
          } else if (response && response.task_info) {
            // 直接数据格式: {task_info: {...}, ...}
            result = response
          } else {
            // 无效响应
            const errorMessage = response?.message || '获取评估结果失败：无有效数据'
            console.error('评估结果获取失败:', response)
            throw new Error(errorMessage)
          }

          // 检查任务是否已经完成计算
          const totalScore = parseFloat(result.task_info?.total_score || 0)
          const facilityCount = result.summary?.total_facilities || 0
          
          console.log(`🔍 检查任务完成状态: 总分=${totalScore}, 设施数=${facilityCount}`)
          
          // 如果分数为0且没有设施详情，说明还在计算中
          if (totalScore === 0 && facilityCount === 0 && retryCount < maxRetries - 1) {
            retryCount++
            console.log(`⏳ 任务还在计算中，等待2秒后重试 (${retryCount}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
          
          // 任务已完成，处理数据并显示结果
          console.log('✅ 任务计算完成，开始处理数据')
          
          // 确保facility_details存在且为数组
          if (!result.facility_details || !Array.isArray(result.facility_details)) {
            console.error('❌ facility_details数据不存在或不是数组:', result.facility_details)
            throw new Error('设施详情数据格式错误')
          }
          
          console.log('📊 处理设施详情数据，数量:', result.facility_details.length)
          
          // 使用后端真实数据
          // 首先按设施分组，将不同交通方式的数据合并
          const facilityMap = new Map()
          
          result.facility_details.forEach(detail => {
            const key = detail.facility_id
            if (!facilityMap.has(key)) {
              facilityMap.set(key, {
                facility_id: detail.facility_id,
                name: detail.facility_name,
                category_code: detail.category_code,
                category_name: detail.category_name,
                address: detail.facility_address,
                distance: detail.distance,
                longitude: detail.facility_lng,
                latitude: detail.facility_lat,
                transport_times: []
              })
            }
            
            // 添加交通方式时间数据（后端存储的是分钟）
            facilityMap.get(key).transport_times.push({
              mode: detail.transport_mode,
              time: (detail.travel_time || 0) * 60 // 转换为秒
            })
          })
          
          // 计算分项得分
          const totalFacilities = result.summary?.total_facilities || facilityMap.size || 0
          
          // 从后端获取的类别统计（包含没有设施的类别）
          const categoryStats = result.category_stats || []
          const totalCategories = result.target_categories?.length || categoryStats.length || 1
          
          // 按类别统计设施数量
          const categoryFacilityCounts = {}
          facilityMap.forEach(f => {
            categoryFacilityCounts[f.category_code] = (categoryFacilityCounts[f.category_code] || 0) + 1
          })
          
          // 设施密度得分：每个选择的类别单独计算（10个满分），然后平均
          // 使用目标类别数量，没有设施的类别计0分
          let totalDensityScore = 0
          if (result.target_categories && result.target_categories.length > 0) {
            result.target_categories.forEach(cat => {
              const code = cat.category_code
              const count = categoryFacilityCounts[code] || 0
              totalDensityScore += Math.min((count / 10) * 100, 100)
            })
          } else {
            Object.values(categoryFacilityCounts).forEach(count => {
              totalDensityScore += Math.min((count / 10) * 100, 100)
            })
          }
          const facility_score = totalCategories > 0 ? totalDensityScore / totalCategories : 0
          
          // 交通便利得分：基于平均距离和时间
          const avgDistance = result.summary?.avg_distance || 0
          const radius = result.task_info?.radius || 1000
          const transport_score = Math.max(100 - (avgDistance / radius) * 50, 50)
          
          resultData.value = {
            total_score: result.task_info?.total_score || 0,
            facility_score: Math.round(facility_score),
            transport_score: Math.round(transport_score),
            facility_count: totalFacilities,
            facilities: Array.from(facilityMap.values())
          }

          // 添加调试日志
          console.log('🔍 前端数据处理结果:')
          console.log('  - API响应 result.task_info.total_score:', result.task_info?.total_score)
          console.log('  - API响应 result.summary.total_facilities:', result.summary?.total_facilities)
          console.log('  - 设置的 resultData.total_score:', resultData.value.total_score)
          console.log('  - 设置的 resultData.facility_count:', resultData.value.facility_count)
          console.log('  - facilityMap大小:', facilityMap.size)
          console.log('  - 完整 resultData:', resultData.value)
          
          taskInfo.value = {
            task_id: result.task_info.task_id,
            center_address: result.task_info.center_address,
            radius: result.task_info.radius,
            created_at: new Date(result.task_info.created_at).toLocaleString(),
            transport_modes: result.transport_modes || []
          }
          
          console.log('评估结果加载成功:', resultData.value)
          loading.value = false
          return // 成功完成，退出函数
          
        } catch (error) {
          console.error('加载评估结果失败:', error)
          
          // 如果是最后一次尝试，显示错误
          if (retryCount >= maxRetries - 1) {
            ElMessage.error('评估计算超时或失败: ' + error.message)
            loading.value = false
            return
          }
          
          // 否则继续重试
          retryCount++
          console.log(`❌ 获取失败，等待2秒后重试 (${retryCount}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      // 如果所有重试都失败了
      ElMessage.error('评估任务计算超时，请稍后重试')
      loading.value = false
    }
    
    const generateMockFacilities = () => {
      const categories = [
        { code: '060200', name: '便利店' },
        { code: '060400', name: '超市' },
        { code: '090300', name: '诊所' },
        { code: '050300', name: '快餐厅' },
        { code: '150700', name: '公交站' }
      ]
      
      const facilities = []
      categories.forEach((category, index) => {
        for (let i = 0; i < Math.floor(Math.random() * 10) + 5; i++) {
          facilities.push({
            facility_id: index * 100 + i,
            name: `${category.name}${i + 1}`,
            category_code: category.code,
            category_name: category.name,
            address: `上海市徐汇区某街道${i + 1}号`,
            distance: Math.floor(Math.random() * 1000) + 100,
            average_score: Math.random() > 0.3 ? (Math.random() * 2 + 3).toFixed(1) : null,
            feedback_count: Math.random() > 0.3 ? Math.floor(Math.random() * 20) + 1 : 0,
            transport_times: transportModes.map(mode => ({
              mode: mode.value,
              time: Math.floor(Math.random() * 1800) + 300 // 5-35分钟
            }))
          })
        }
      })
      
      return facilities
    }
    
    const getTransportStats = (mode) => {
      if (!resultData.value?.facilities) return { avgTime: 0, minTime: 0, within15min: 0 }
      
      // 映射前端模式到后端模式
      const modeMap = {
        'walking': 'walk',
        'transit': 'bus',
        'driving': 'car',
        'cycling': 'ride'
      }
      
      const backendMode = modeMap[mode] || mode
      
      const times = resultData.value.facilities
        .map(f => f.transport_times?.find(t => t.mode === backendMode)?.time)
        .filter(t => t != null)
      
      if (times.length === 0) return { avgTime: 0, minTime: 0, within15min: 0 }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
      const minTime = Math.min(...times)
      const within15min = Math.round((times.filter(t => t <= 900).length / times.length) * 100)
      
      return { avgTime, minTime, within15min }
    }
    
    const getTransportChartOption = (mode) => {
      if (!resultData.value?.facilities) return {}
      
      // 映射前端模式到后端模式
      const modeMap = {
        'walking': 'walk',
        'transit': 'bus', 
        'driving': 'car',
        'cycling': 'ride'
      }
      
      const backendMode = modeMap[mode] || mode
      const timeRanges = ['0-5分钟', '5-10分钟', '10-15分钟', '15-30分钟', '30分钟以上']
      const data = [0, 0, 0, 0, 0]
      
      resultData.value.facilities.forEach(facility => {
        const timeData = facility.transport_times?.find(t => t.mode === backendMode)
        if (timeData) {
          const minutes = timeData.time / 60
          if (minutes <= 5) data[0]++
          else if (minutes <= 10) data[1]++
          else if (minutes <= 15) data[2]++
          else if (minutes <= 30) data[3]++
          else data[4]++
        }
      })
      
      return {
        title: {
          text: `${getModeLabel(mode)}时间分布`,
          left: 'center'
        },
        tooltip: {
          trigger: 'axis'
        },
        xAxis: {
          type: 'category',
          data: timeRanges
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          name: '设施数量',
          type: 'bar',
          data,
          itemStyle: {
            color: '#409EFF'
          }
        }]
      }
    }
    
    const getModeLabel = (mode) => {
      const modeMap = {
        walking: '步行',
        transit: '公交',
        driving: '驾车',
        cycling: '骑行',
        // 后端模式
        walk: '步行',
        bus: '公交',
        car: '驾车',
        ride: '骑行'
      }
      return modeMap[mode] || mode
    }
    
    const applyFacilityFilter = () => {
      // 过滤逻辑已在computed中实现
    }
    
    const viewFacilityDetail = (facility) => {
      // 可以打开设施详情弹窗或跳转到详情页
      ElMessage.info(`查看 ${facility.name} 的详情`)
    }
    
    onMounted(() => {
      loadEvaluationResult()
    })
    
    return {
      loading,
      loadingMessage,
      resultData,
      taskInfo,
      activeTransportMode,
      facilityFilter,
      transportModes,
      categoryStats,
      filteredFacilities,
      categoryChartOption,
      suggestions,
      loadEvaluationResult,
      getTransportStats,
      getTransportChartOption,
      getModeLabel,
      applyFacilityFilter,
      viewFacilityDetail,
      formatTime,
      formatDistance,
      getScoreColor,
      getScoreDescription
    }
  }
}
</script>

<style scoped>
.evaluation-result-container {
  max-width: 1200px;
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

.result-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
}

.score-section {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.score-display {
  text-align: center;
  margin-right: 40px;
}

.score-number {
  font-size: 72px;
  font-weight: bold;
  line-height: 1;
}

.score-label {
  font-size: 16px;
  opacity: 0.9;
  margin-top: 8px;
}

.score-description h3 {
  font-size: 24px;
  margin: 0 0 8px;
}

.score-description p {
  opacity: 0.9;
  margin: 0;
}

.score-breakdown {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 24px;
}

.breakdown-item {
  text-align: center;
}

.breakdown-label {
  font-size: 14px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.breakdown-value {
  font-size: 20px;
  font-weight: bold;
}

.category-stats {
  margin-top: 16px;
}

.chart-container {
  height: 350px;
}

.chart {
  height: 100%;
  width: 100%;
}

.category-list {
  max-height: 350px;
  overflow-y: auto;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}

.category-item:last-child {
  border-bottom: none;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name {
  font-weight: 500;
}

.facility-count {
  color: #409EFF;
  font-size: 14px;
}

.category-score {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-text {
  font-size: 14px;
  color: #909399;
}

.transport-analysis {
  margin-top: 16px;
}

.transport-content {
  padding: 16px 0;
}

.transport-summary {
  margin-bottom: 24px;
}

.summary-item {
  text-align: center;
}

.summary-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.facility-filters {
  margin-bottom: 16px;
}

.transport-times {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transport-time-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.mode-label {
  color: #909399;
}

.time-value {
  color: #303133;
  font-weight: 500;
}

.score-detail {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.no-score {
  color: #c0c4cc;
  font-size: 12px;
}

.suggestions {
  margin-top: 16px;
}

.loading-container,
.error-state {
  text-align: center;
  padding: 80px 20px;
}

.loading-container p {
  margin-top: 16px;
  color: #909399;
}

.loading-detail {
  font-size: 14px;
  color: #666;
  font-weight: 500;
  margin-top: 8px !important;
}

@media (max-width: 768px) {
  .evaluation-result-container {
    margin: 0 16px;
  }
  
  .score-section {
    flex-direction: column;
    text-align: center;
  }
  
  .score-display {
    margin-right: 0;
    margin-bottom: 24px;
  }
  
  .score-number {
    font-size: 56px;
  }
  
  .chart-container {
    height: 250px;
  }
  
  .transport-times {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
