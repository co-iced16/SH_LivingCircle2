<template>
  <div class="facility-feedback-container">
    <div class="page-header">
      <h1>设施评价</h1>
      <p>请选择具体设施并进行评价</p>
    </div>

    <div class="card-container">
      <el-steps :active="currentStep" finish-status="success" style="margin-bottom: 32px;">
        <el-step title="选择设施" />
        <el-step title="填写评价" />
        <el-step title="提交完成" />
      </el-steps>
      
      <!-- 第一步：选择设施 -->
      <div v-show="currentStep === 0">
        <div class="section-title">搜索设施</div>
        
        <el-form :inline="true" class="search-form">
          <el-form-item label="搜索方式">
            <el-radio-group v-model="searchType">
              <el-radio label="system">系统设施</el-radio>
              <el-radio label="map">地图搜索</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        
        <!-- 系统设施搜索 -->
        <div v-if="searchType === 'system'">
          <el-form :inline="true" class="search-form">
            <el-form-item label="设施类型">
              <el-cascader
                v-model="selectedCategory"
                :options="facilityCategories"
                :props="cascaderProps"
                placeholder="请选择设施类型"
                clearable
                style="width: 200px;"
              />
            </el-form-item>
            
            <el-form-item label="关键词">
              <el-input
                v-model="searchKeyword"
                placeholder="请输入设施名称"
                clearable
                style="width: 200px;"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="searchSystemFacilities" :loading="searchLoading">
                搜索
              </el-button>
            </el-form-item>
          </el-form>
          
          <!-- 系统设施搜索结果 -->
          <div v-if="systemFacilities.length > 0" class="facility-list">
            <div
              v-for="facility in systemFacilities"
              :key="facility.facility_id"
              class="facility-item"
              :class="{ 'selected': selectedFacility?.facility_id === facility.facility_id }"
              @click="selectFacility(facility)"
            >
              <div class="facility-header">
                <h4>{{ facility.name }}</h4>
                <el-tag size="small">{{ facility.category_name }}</el-tag>
              </div>
              <div class="facility-address">
                <el-icon><LocationInformation /></el-icon>
                {{ facility.address }}
              </div>
              <div v-if="facility.average_score" class="facility-rating">
                <el-rate :model-value="facility.average_score" disabled show-score />
                <span class="rating-count">({{ facility.feedback_count }}条评价)</span>
              </div>
            </div>
          </div>
          
          <!-- 没找到时的提示和切换按钮 -->
          <div v-else-if="systemSearched && systemFacilities.length === 0" class="no-results">
            <el-empty description="未找到匹配的设施">
              <el-button type="primary" @click="switchToMapSearch">
                没找到？试试高德地图搜索
              </el-button>
            </el-empty>
          </div>
        </div>
        
        <!-- 地图搜索 -->
        <div v-else-if="searchType === 'map'">
          <el-form :inline="true" class="search-form">
            <el-form-item label="搜索关键词">
              <el-input
                v-model="mapSearchKeyword"
                placeholder="请输入设施名称或地址"
                clearable
                style="width: 300px;"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="searchMapFacilities" :loading="searchLoading">
                搜索
              </el-button>
            </el-form-item>
          </el-form>
          
          <!-- 地图搜索结果 -->
          <div v-if="mapFacilities.length > 0" class="facility-list">
            <div
              v-for="facility in mapFacilities"
              :key="facility.id"
              class="facility-item"
              :class="{ 'selected': selectedFacility?.id === facility.id }"
              @click="selectMapFacility(facility)"
            >
              <div class="facility-header">
                <h4>{{ facility.name }}</h4>
                <el-tag size="small" type="warning">地图数据</el-tag>
              </div>
              <div class="facility-address">
                <el-icon><LocationInformation /></el-icon>
                {{ facility.address }}
              </div>
              <div class="facility-distance" v-if="facility.distance">
                距离: {{ formatDistance(facility.distance) }}
              </div>
            </div>
          </div>
          
          <!-- 地图搜索无结果提示 -->
          <div v-else-if="mapSearched && mapFacilities.length === 0" class="no-results">
            <el-empty description="未找到匹配的设施" />
          </div>
        </div>
        
        <div style="margin-top: 24px;">
          <el-button 
            type="primary" 
            @click="nextStep" 
            :disabled="!selectedFacility"
          >
            下一步
          </el-button>
        </div>
      </div>
      
      <!-- 第二步：填写评价 -->
      <div v-show="currentStep === 1">
        <div class="section-title">选中的设施</div>
        
        <div v-if="selectedFacility" class="selected-facility">
          <div class="facility-info">
            <h3>{{ selectedFacility.name }}</h3>
            <p>{{ selectedFacility.address || selectedFacility.formatted_address }}</p>
            <el-tag v-if="selectedFacility.category_name">{{ selectedFacility.category_name }}</el-tag>
            <el-tag v-else type="warning">地图数据</el-tag>
          </div>
        </div>
        
        <div class="section-title" style="margin-top: 32px;">填写评价</div>
        
        <el-form
          ref="feedbackFormRef"
          :model="feedbackForm"
          :rules="feedbackRules"
          label-width="120px"
        >
          <el-form-item label="便利度评分" prop="score">
            <el-rate
              v-model="feedbackForm.score"
              :max="5"
              show-text
              :texts="['很不满意', '不太满意', '一般', '比较满意', '非常满意']"
            />
          </el-form-item>
          
          <el-form-item label="详细评价" prop="content">
            <el-input
              v-model="feedbackForm.content"
              type="textarea"
              :rows="6"
              placeholder="请详细描述您对该设施的评价，包括服务质量、环境、价格、便利性等方面..."
            />
          </el-form-item>
        </el-form>
        
        <div style="margin-top: 24px;">
          <el-button @click="prevStep">上一步</el-button>
          <el-button type="primary" @click="nextStep">下一步</el-button>
        </div>
      </div>
      
      <!-- 第三步：提交确认 -->
      <div v-show="currentStep === 2">
        <div class="section-title">确认评价信息</div>
        
        <div class="review-content">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="设施名称">
              {{ selectedFacility?.name }}
            </el-descriptions-item>
            <el-descriptions-item label="设施地址">
              {{ selectedFacility?.address || selectedFacility?.formatted_address }}
            </el-descriptions-item>
            <el-descriptions-item label="便利度评分">
              <el-rate :model-value="feedbackForm.score" disabled />
              <span style="margin-left: 8px;">{{ feedbackForm.score }}分</span>
            </el-descriptions-item>
            <el-descriptions-item label="详细评价">
              {{ feedbackForm.content }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <div style="margin-top: 24px;">
          <el-button @click="prevStep">上一步</el-button>
          <el-button type="primary" @click="submitFeedback" :loading="submitLoading">
            提交评价
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { LocationInformation } from '@element-plus/icons-vue'
import { formatDistance } from '@/utils/map'

export default {
  name: 'FacilityFeedback',
  components: {
    LocationInformation
  },
  setup() {
    const store = useStore()
    
    const currentStep = ref(0)
    const searchType = ref('system')
    const searchLoading = ref(false)
    const submitLoading = ref(false)
    
    // 搜索状态跟踪
    const systemSearched = ref(false)
    const mapSearched = ref(false)
    
    // 搜索相关
    const selectedCategory = ref([])
    const searchKeyword = ref('')
    const mapSearchKeyword = ref('')
    
    // 设施数据
    const systemFacilities = ref([])
    const mapFacilities = ref([])
    const selectedFacility = ref(null)
    
    const feedbackForm = reactive({
      score: null,
      content: ''
    })
    
    const feedbackRules = {
      score: [
        { required: true, message: '请选择评分', trigger: 'change' }
      ],
      content: [
        { required: true, message: '请填写评价内容', trigger: 'blur' },
        { min: 10, message: '评价内容至少10个字符', trigger: 'blur' }
      ]
    }
    
    const feedbackFormRef = ref()
    
    // 级联选择器配置
    const cascaderProps = {
      value: 'category_code',
      label: 'category_name',
      children: 'children',
      checkStrictly: true
    }
    
    // 从store获取设施分类
    const facilityCategories = computed(() => store.getters['facilities/categoriesTree'])
    
    // 搜索系统设施
    const searchSystemFacilities = async () => {
      searchLoading.value = true
      systemSearched.value = false
      
      try {
        const params = {}
        if (selectedCategory.value.length > 0) {
          params.category_code = selectedCategory.value[selectedCategory.value.length - 1]
        }
        if (searchKeyword.value) {
          params.keyword = searchKeyword.value
        }
        
        const facilities = await store.dispatch('facilities/searchFacilities', params)
        systemFacilities.value = facilities
        systemSearched.value = true
        
        if (facilities.length === 0) {
          ElMessage.info('未找到符合条件的设施')
        }
      } catch (error) {
        ElMessage.error('搜索失败')
      } finally {
        searchLoading.value = false
      }
    }
    
    // 搜索地图设施
    const searchMapFacilities = async () => {
      if (!mapSearchKeyword.value.trim()) {
        ElMessage.warning('请输入搜索关键词')
        return
      }
      
      searchLoading.value = true
      mapSearched.value = false
      
      try {
        const results = await store.dispatch('facilities/searchMapFacilities', {
          keywords: mapSearchKeyword.value,
          city: '上海',
          limit: 20
        })
        
        mapFacilities.value = results
        mapSearched.value = true
        
        if (results.length === 0) {
          ElMessage.info('未找到相关设施')
        }
      } catch (error) {
        ElMessage.error('搜索失败')
      } finally {
        searchLoading.value = false
      }
    }
    
    // 切换到高德地图搜索
    const switchToMapSearch = () => {
      searchType.value = 'map'
      // 如果有搜索关键词，复制到地图搜索
      if (searchKeyword.value) {
        mapSearchKeyword.value = searchKeyword.value
      }
      ElMessage.info('已切换到高德地图搜索')
    }
    
    // 选择系统设施
    const selectFacility = (facility) => {
      selectedFacility.value = facility
    }
    
    // 选择地图设施
    const selectMapFacility = (facility) => {
      selectedFacility.value = facility
    }
    
    // 下一步
    const nextStep = async () => {
      if (currentStep.value === 1) {
        // 验证评价表单
        try {
          await feedbackFormRef.value?.validate()
        } catch (error) {
          return
        }
      }
      
      if (currentStep.value < 2) {
        currentStep.value++
      }
    }
    
    // 上一步
    const prevStep = () => {
      if (currentStep.value > 0) {
        currentStep.value--
      }
    }
    
    // 提交评价
    const submitFeedback = async () => {
      submitLoading.value = true
      try {
        let feedbackData = {
          score: feedbackForm.score,
          content: feedbackForm.content
        }
        
        // 如果选择的是系统已有设施
        if (selectedFacility.value.facility_id) {
          feedbackData.facility_id = selectedFacility.value.facility_id
        } else {
          // 如果是地图搜索的新设施，需要提供创建设施的信息
          feedbackData.facility_name = selectedFacility.value.name
          feedbackData.formatted_address = selectedFacility.value.address
          feedbackData.longitude = selectedFacility.value.longitude
          feedbackData.latitude = selectedFacility.value.latitude
          feedbackData.category_code = selectedFacility.value.typecode || '060000' // 使用高德的typecode或默认分类
        }
        
        const result = await store.dispatch('feedback/submitFacilityFeedback', feedbackData)
        
        if (result.success) {
          ElMessage.success('评价提交成功！')
          resetForm()
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error('提交失败')
      } finally {
        submitLoading.value = false
      }
    }
    
    // 重置表单
    const resetForm = () => {
      currentStep.value = 0
      searchType.value = 'system'
      selectedFacility.value = null
      systemFacilities.value = []
      mapFacilities.value = []
      systemSearched.value = false
      mapSearched.value = false
      feedbackForm.score = null
      feedbackForm.content = ''
      selectedCategory.value = []
      searchKeyword.value = ''
      mapSearchKeyword.value = ''
    }
    
    onMounted(() => {
      // 加载设施分类
      store.dispatch('facilities/fetchCategories')
    })
    
    return {
      currentStep,
      searchType,
      searchLoading,
      submitLoading,
      systemSearched,
      mapSearched,
      selectedCategory,
      searchKeyword,
      mapSearchKeyword,
      systemFacilities,
      mapFacilities,
      selectedFacility,
      feedbackForm,
      feedbackRules,
      feedbackFormRef,
      facilityCategories,
      cascaderProps,
      searchSystemFacilities,
      searchMapFacilities,
      switchToMapSearch,
      selectFacility,
      selectMapFacility,
      nextStep,
      prevStep,
      submitFeedback,
      resetForm,
      formatDistance
    }
  }
}
</script>

<style scoped>
.facility-feedback-container {
  max-width: 900px;
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

.search-form {
  margin-bottom: 24px;
}

.search-form .el-form-item {
  margin-bottom: 16px;
}

.facility-item {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.facility-item:hover {
  border-color: #409EFF;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.facility-item.selected {
  border-color: #409EFF;
  background-color: #ecf5ff;
}

.facility-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.facility-header h4 {
  margin: 0;
  color: #303133;
  font-size: 16px;
}

.facility-address {
  display: flex;
  align-items: center;
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}

.facility-address .el-icon {
  margin-right: 4px;
}

.facility-rating {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating-count {
  font-size: 12px;
  color: #909399;
}

.facility-distance {
  color: #909399;
  font-size: 12px;
}

.selected-facility {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.facility-info h3 {
  margin: 0 0 8px;
  color: #303133;
}

.facility-info p {
  margin: 0 0 8px;
  color: #666;
}

.review-content {
  margin: 24px 0;
}

.no-results {
  text-align: center;
  margin: 40px 0;
}

.no-results .el-empty {
  padding: 20px 0;
}

@media (max-width: 768px) {
  .facility-feedback-container {
    margin: 0 16px;
  }
  
  .search-form .el-form-item {
    width: 100%;
  }
  
  .search-form .el-input,
  .search-form .el-cascader {
    width: 100% !important;
  }
  
  .facility-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
