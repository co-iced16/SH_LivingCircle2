<template>
  <div class="facility-management-container">
    <div class="page-header">
      <h1>设施管理</h1>
      <p>管理系统中的设施数据</p>
    </div>

    <!-- 操作栏 -->
    <div class="card-container">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            添加设施
          </el-button>
          <el-button @click="showImportDialog">
            <el-icon><Upload /></el-icon>
            高德导入
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索设施名称"
            clearable
            style="width: 200px; margin-right: 12px;"
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-select
            v-model="selectedCategory"
            placeholder="选择分类"
            clearable
            style="width: 180px;"
            @change="handleCategoryFilter"
          >
            <el-option
              v-for="category in categories"
              :key="category.category_code"
              :label="category.category_name"
              :value="category.category_code"
            />
          </el-select>
        </div>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="card-container">
      <h2 class="section-title">数据统计</h2>
      <el-row :gutter="24">
        <el-col :span="8">
          <div class="stat-card clickable" :class="{ active: viewMode === 'all' }" @click="switchViewMode('all')">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">总设施数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card clickable" :class="{ active: viewMode === 'withFeedback' }" @click="switchViewMode('withFeedback')">
            <div class="stat-number">{{ stats.withFeedback }}</div>
            <div class="stat-label">有评价设施</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card clickable" :class="{ active: viewMode === 'categories' }" @click="switchViewMode('categories')">
            <div class="stat-number">{{ stats.categories }}</div>
            <div class="stat-label">设施分类</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 设施列表 -->
    <div class="card-container" v-if="viewMode !== 'categories'">
      <div class="section-header">
        <h2 class="section-title">{{ viewMode === 'withFeedback' ? '有评价设施列表' : '设施列表' }}</h2>
        <span class="result-count">共 {{ pagination.total }} 条结果</span>
      </div>
      
      <el-table :data="facilities" v-loading="loading" style="width: 100%" stripe>
        <el-table-column prop="facility_id" label="ID" width="80" />
        <el-table-column prop="name" label="设施名称" min-width="150" />
        <el-table-column prop="category_name" label="分类" width="150" />
        <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
        <el-table-column label="坐标" width="180">
          <template #default="{ row }">
            <span v-if="row.longitude && row.latitude">
              {{ Number(row.longitude).toFixed(4) }}, {{ Number(row.latitude).toFixed(4) }}
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>
        <el-table-column label="评价" width="120" align="center">
          <template #default="{ row }">
            <div v-if="row.average_score > 0">
              <span class="score-value">{{ Number(row.average_score).toFixed(1) }}</span>
              <span class="feedback-count">({{ row.feedback_count }}条)</span>
            </div>
            <span v-else class="no-rating">暂无评价</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" link size="small" @click="editFacility(row)">
                编辑
              </el-button>
              <el-popconfirm
                title="确定要删除这个设施吗？"
                @confirm="deleteFacility(row)"
              >
                <template #reference>
                  <el-button type="danger" link size="small">
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    
    <!-- 设施分类列表 -->
    </div>
    <div class="card-container" v-else>
      <h2 class="section-title">设施分类列表</h2>
      <el-table :data="categories" v-loading="loading" style="width: 100%" stripe>
        <el-table-column prop="category_code" label="分类编码" width="150" />
        <el-table-column prop="category_name" label="分类名称" min-width="200" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="text" size="small" @click="filterByCategory(row.category_code)">
              查看设施
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @size-change="loadFacilities"
          @current-change="loadFacilities"
        />
      </div>
    </div>

    <!-- 添加/编辑设施弹窗 -->
    <el-dialog
      v-model="facilityDialogVisible"
      :title="isEdit ? '编辑设施' : '添加设施'"
      width="600px"
      @closed="resetFacilityForm"
    >
      <el-form
        ref="facilityFormRef"
        :model="facilityForm"
        :rules="facilityRules"
        label-width="100px"
      >
        <el-form-item label="设施名称" prop="name">
          <el-input v-model="facilityForm.name" placeholder="请输入设施名称" />
        </el-form-item>
        
        <el-form-item label="设施分类" prop="category_code">
          <el-select
            v-model="facilityForm.category_code"
            placeholder="请选择设施分类"
            style="width: 100%;"
            filterable
          >
            <el-option
              v-for="category in categories"
              :key="category.category_code"
              :label="category.category_name"
              :value="category.category_code"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="详细地址" prop="formatted_address">
          <el-input
            v-model="facilityForm.formatted_address"
            placeholder="请输入详细地址，失焦后自动获取坐标"
            @blur="geocodeAddress"
          />
        </el-form-item>
        
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude">
              <el-input-number
                v-model="facilityForm.longitude"
                :precision="6"
                :controls="false"
                placeholder="经度"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude">
              <el-input-number
                v-model="facilityForm.latitude"
                :precision="6"
                :controls="false"
                placeholder="纬度"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      
      <template #footer>
        <el-button @click="facilityDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFacility" :loading="saveLoading">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 高德导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="从高德地图导入设施" width="500px">
      <el-form :model="importForm" label-width="100px">
        <el-form-item label="搜索关键词">
          <el-input v-model="importForm.keywords" placeholder="如：便利店、超市、医院等" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="importForm.city" placeholder="上海" />
        </el-form-item>
        <el-form-item label="设施分类">
          <el-select v-model="importForm.category_code" placeholder="选择分类" style="width: 100%;" filterable>
            <el-option
              v-for="category in categories"
              :key="category.category_code"
              :label="category.category_name"
              :value="category.category_code"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="importFromAmap" :loading="importLoading">
          开始导入
        </el-button>
      </template>
    </el-dialog>

    <!-- 设施评价弹窗 -->
    <el-dialog v-model="feedbackDialogVisible" title="设施评价" width="700px">
      <div v-if="selectedFacility">
        <div class="facility-info">
          <h3>{{ selectedFacility.name }}</h3>
          <p>{{ selectedFacility.address }}</p>
        </div>
        
        <el-divider />
        
        <div v-if="feedbackLoading" class="loading-feedback">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>加载中...</span>
        </div>
        <div v-else-if="facilityFeedbacks.length > 0" class="feedback-list">
          <div
            v-for="feedback in facilityFeedbacks"
            :key="feedback.feedback_id"
            class="feedback-item"
          >
            <div class="feedback-header">
              <div class="user-info">
                <span class="username">{{ feedback.username || '匿名用户' }}</span>
                <el-rate :model-value="feedback.score" disabled size="small" />
                <span class="score-text">{{ feedback.score }}分</span>
              </div>
              <div class="feedback-date">{{ formatDate(feedback.submitted_at) }}</div>
            </div>
            <div class="feedback-content">{{ feedback.content || '用户未留下文字评价' }}</div>
          </div>
        </div>
        <el-empty v-else description="暂无评价" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { AmapUtils } from '@/utils/map'

export default {
  name: 'FacilityManagement',
  setup() {
    const loading = ref(false)
    const saveLoading = ref(false)
    const importLoading = ref(false)
    const feedbackLoading = ref(false)
    
    const facilities = ref([])
    const categories = ref([])
    const searchKeyword = ref('')
    const selectedCategory = ref('')
    const currentPage = ref(1)
    const pageSize = ref(20)
    const pagination = ref({ total: 0, pages: 0 })
    const viewMode = ref('all') // 'all', 'withFeedback', 'categories'
    
    const stats = ref({
      total: 0,
      withFeedback: 0,
      categories: 0
    })
    
    const facilityDialogVisible = ref(false)
    const importDialogVisible = ref(false)
    const feedbackDialogVisible = ref(false)
    const isEdit = ref(false)
    const selectedFacility = ref(null)
    const facilityFeedbacks = ref([])
    
    const facilityFormRef = ref()
    const facilityForm = reactive({
      facility_id: null,
      name: '',
      category_code: '',
      formatted_address: '',
      longitude: null,
      latitude: null
    })
    
    const importForm = reactive({
      keywords: '',
      city: '上海',
      category_code: ''
    })
    
    const facilityRules = {
      name: [{ required: true, message: '请输入设施名称', trigger: 'blur' }],
      category_code: [{ required: true, message: '请选择设施分类', trigger: 'change' }],
      formatted_address: [{ required: true, message: '请输入详细地址', trigger: 'blur' }],
      longitude: [{ required: true, message: '请输入经度', trigger: 'blur' }],
      latitude: [{ required: true, message: '请输入纬度', trigger: 'blur' }]
    }

    const loadCategories = async () => {
      try {
        const res = await api.get('/facilities/categories')
        if (res.success) {
          categories.value = res.data
          stats.value.categories = res.data.length
        }
      } catch (error) {
        console.error('获取分类失败:', error)
      }
    }

    const loadStats = async () => {
      try {
        const res = await api.get('/facilities/stats')
        if (res.success) {
          stats.value.total = res.data.total
          stats.value.withFeedback = res.data.with_feedback || 0
        }
      } catch (error) {
        console.error('获取统计失败:', error)
      }
    }

    const loadFacilities = async () => {
      loading.value = true
      try {
        const res = await api.get('/facilities/with-feedback', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value || undefined,
            category_code: selectedCategory.value || undefined,
            with_feedback_only: viewMode.value === 'withFeedback' ? 'true' : undefined
          }
        })
        if (res.success) {
          facilities.value = res.data.facilities
          pagination.value = res.data.pagination
        }
      } catch (error) {
        console.error('获取设施列表失败:', error)
        ElMessage.error('获取设施列表失败')
      } finally {
        loading.value = false
      }
    }

    const handleSearch = () => {
      currentPage.value = 1
      loadFacilities()
    }

    const handleCategoryFilter = () => {
      currentPage.value = 1
      loadFacilities()
    }

    const switchViewMode = (mode) => {
      viewMode.value = mode
      currentPage.value = 1
      selectedCategory.value = ''
      searchKeyword.value = ''
      if (mode !== 'categories') {
        loadFacilities()
      }
    }

    const filterByCategory = (categoryCode) => {
      viewMode.value = 'all'
      selectedCategory.value = categoryCode
      currentPage.value = 1
      loadFacilities()
    }

    const showAddDialog = () => {
      isEdit.value = false
      facilityDialogVisible.value = true
    }

    const showImportDialog = () => {
      importDialogVisible.value = true
    }

    const editFacility = async (facility) => {
      isEdit.value = true
      // 获取详情
      try {
        const res = await api.get(`/facilities/${facility.facility_id}`)
        if (res.success) {
          const data = res.data
          facilityForm.facility_id = data.facility_id
          facilityForm.name = data.name
          facilityForm.category_code = data.category_code
          facilityForm.formatted_address = data.address
          facilityForm.longitude = parseFloat(data.longitude)
          facilityForm.latitude = parseFloat(data.latitude)
          facilityDialogVisible.value = true
        }
      } catch (error) {
        // 如果获取详情失败，使用列表数据
        facilityForm.facility_id = facility.facility_id
        facilityForm.name = facility.name
        facilityForm.category_code = facility.category_code
        facilityForm.formatted_address = facility.address
        facilityForm.longitude = parseFloat(facility.longitude)
        facilityForm.latitude = parseFloat(facility.latitude)
        facilityDialogVisible.value = true
      }
    }

    const viewFeedbacks = async (facility) => {
      selectedFacility.value = facility
      feedbackDialogVisible.value = true
      feedbackLoading.value = true
      
      try {
        const res = await api.get('/feedback/facility', {
          params: { facility_id: facility.facility_id }
        })
        if (res.success) {
          facilityFeedbacks.value = res.data.feedbacks || []
        }
      } catch (error) {
        facilityFeedbacks.value = []
      } finally {
        feedbackLoading.value = false
      }
    }

    const deleteFacility = async (facility) => {
      try {
        const res = await api.delete(`/facilities/${facility.facility_id}`)
        if (res.success) {
          ElMessage.success('删除成功')
          loadFacilities()
          loadStats()
        }
      } catch (error) {
        ElMessage.error('删除失败')
      }
    }

    const geocodeAddress = async () => {
      if (!facilityForm.formatted_address) return
      
      try {
        const result = await AmapUtils.geocode(facilityForm.formatted_address)
        if (result && result.length > 0) {
          facilityForm.longitude = result[0].longitude
          facilityForm.latitude = result[0].latitude
          ElMessage.success('坐标获取成功')
        }
      } catch (error) {
        console.error('地理编码失败:', error)
      }
    }

    const saveFacility = async () => {
      if (!facilityFormRef.value) return
      
      try {
        await facilityFormRef.value.validate()
        saveLoading.value = true
        
        if (isEdit.value) {
          const res = await api.put(`/facilities/${facilityForm.facility_id}`, {
            name: facilityForm.name,
            category_code: facilityForm.category_code,
            address: facilityForm.formatted_address,
            longitude: facilityForm.longitude,
            latitude: facilityForm.latitude
          })
          if (res.success) {
            ElMessage.success('更新成功')
          }
        } else {
          const res = await api.post('/facilities', {
            name: facilityForm.name,
            category_code: facilityForm.category_code,
            formatted_address: facilityForm.formatted_address,
            longitude: facilityForm.longitude,
            latitude: facilityForm.latitude
          })
          if (res.success) {
            ElMessage.success('添加成功')
          }
        }
        
        facilityDialogVisible.value = false
        loadFacilities()
        loadStats()
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('保存失败')
        }
      } finally {
        saveLoading.value = false
      }
    }

    const resetFacilityForm = () => {
      facilityFormRef.value?.resetFields()
      facilityForm.facility_id = null
      facilityForm.name = ''
      facilityForm.category_code = ''
      facilityForm.formatted_address = ''
      facilityForm.longitude = null
      facilityForm.latitude = null
    }

    const importFromAmap = async () => {
      if (!importForm.keywords || !importForm.category_code) {
        ElMessage.warning('请填写搜索关键词和选择分类')
        return
      }
      
      importLoading.value = true
      try {
        const res = await api.post('/facilities/import', {
          keywords: importForm.keywords,
          city: importForm.city,
          category_code: importForm.category_code
        })
        if (res.success) {
          ElMessage.success(res.data.message)
          importDialogVisible.value = false
          loadFacilities()
          loadStats()
        }
      } catch (error) {
        ElMessage.error('导入失败')
      } finally {
        importLoading.value = false
      }
    }

    const formatDate = (date) => {
      if (!date) return ''
      return new Date(date).toLocaleString('zh-CN')
    }

    onMounted(() => {
      loadCategories()
      loadStats()
      loadFacilities()
    })

    return {
      loading,
      saveLoading,
      importLoading,
      feedbackLoading,
      facilities,
      categories,
      searchKeyword,
      selectedCategory,
      currentPage,
      pageSize,
      pagination,
      stats,
      viewMode,
      facilityDialogVisible,
      importDialogVisible,
      feedbackDialogVisible,
      isEdit,
      selectedFacility,
      facilityFeedbacks,
      facilityFormRef,
      facilityForm,
      importForm,
      facilityRules,
      loadFacilities,
      handleSearch,
      handleCategoryFilter,
      switchViewMode,
      filterByCategory,
      showAddDialog,
      showImportDialog,
      editFacility,
      deleteFacility,
      geocodeAddress,
      saveFacility,
      resetFacilityForm,
      importFromAmap,
      formatDate
    }
  }
}
</script>

<style scoped>
.facility-management-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 8px;
}

.page-header p {
  color: #909399;
  margin: 0;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.stat-card {
  background: white;
  padding: 20px;
  text-align: center;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.stat-card.clickable {
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card.clickable:hover {
  border-color: #409EFF;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
}

.stat-card.clickable.active {
  border-color: #409EFF;
  background: #ecf5ff;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 8px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}

.no-data {
  color: #c0c4cc;
}

.score-value {
  color: #f7ba2a;
  font-weight: bold;
}

.feedback-count {
  color: #909399;
  font-size: 12px;
  margin-left: 4px;
}

.no-rating {
  color: #c0c4cc;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.result-count {
  color: #909399;
  font-size: 14px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.facility-info {
  margin-bottom: 16px;
}

.facility-info h3 {
  margin: 0 0 8px;
  color: #303133;
}

.facility-info p {
  margin: 0;
  color: #666;
}

.loading-feedback {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.loading-feedback .el-icon {
  font-size: 24px;
  margin-right: 8px;
}

.feedback-list {
  max-height: 400px;
  overflow-y: auto;
}

.feedback-item {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 12px;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  font-weight: 500;
}

.score-text {
  font-size: 12px;
  color: #909399;
}

.feedback-date {
  color: #909399;
  font-size: 12px;
}

.feedback-content {
  color: #606266;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 16px;
  }
  
  .toolbar-left,
  .toolbar-right {
    width: 100%;
  }
  
  .toolbar-right {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
