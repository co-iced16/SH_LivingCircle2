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
          <el-button @click="batchImport">
            <el-icon><Upload /></el-icon>
            批量导入
          </el-button>
          <el-button @click="exportData">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索设施名称或地址"
            clearable
            style="width: 250px; margin-right: 12px;"
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
            style="width: 200px;"
            @change="handleCategoryFilter"
          >
            <el-option
              v-for="category in facilityCategories"
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
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">总设施数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.withFeedback }}</div>
            <div class="stat-label">有评价设施</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.categories }}</div>
            <div class="stat-label">设施分类</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-number">{{ stats.lastWeek }}</div>
            <div class="stat-label">本周新增</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 设施列表 -->
    <div class="card-container">
      <h2 class="section-title">设施列表</h2>
      
      <el-table
        :data="facilities"
        v-loading="loading"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="设施名称" min-width="150" />
        <el-table-column prop="category_name" label="分类" width="120" />
        <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
        <el-table-column label="坐标" width="150">
          <template #default="{ row }">
            {{ row.longitude }}, {{ row.latitude }}
          </template>
        </el-table-column>
        <el-table-column label="评价" width="100" align="center">
          <template #default="{ row }">
            <div v-if="row.average_score">
              <el-rate :model-value="row.average_score" disabled size="small" />
              <div class="rating-text">{{ row.feedback_count }}条</div>
            </div>
            <span v-else class="no-rating">暂无评价</span>
          </template>
        </el-table-column>
        <el-table-column prop="last_updated" label="更新时间" width="160" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="text" size="small" @click="editFacility(row)">
              编辑
            </el-button>
            <el-button type="text" size="small" @click="viewFeedbacks(row)">
              评价
            </el-button>
            <el-popconfirm
              title="确定要删除这个设施吗？"
              @confirm="deleteFacility(row)"
            >
              <template #reference>
                <el-button type="text" size="small" style="color: #f56c6c;">
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
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
          <el-cascader
            v-model="facilityForm.category_code"
            :options="facilityCategories"
            :props="cascaderProps"
            placeholder="请选择设施分类"
            style="width: 100%;"
          />
        </el-form-item>
        
        <el-form-item label="详细地址" prop="address">
          <el-input
            v-model="facilityForm.address"
            placeholder="请输入详细地址"
            @blur="geocodeAddress"
          />
        </el-form-item>
        
        <el-form-item label="经度" prop="longitude">
          <el-input-number
            v-model="facilityForm.longitude"
            :precision="6"
            placeholder="经度"
            style="width: 100%;"
          />
        </el-form-item>
        
        <el-form-item label="纬度" prop="latitude">
          <el-input-number
            v-model="facilityForm.latitude"
            :precision="6"
            placeholder="纬度"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="facilityDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFacility" :loading="saveLoading">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 设施评价弹窗 -->
    <el-dialog
      v-model="feedbackDialogVisible"
      title="设施评价"
      width="800px"
    >
      <div v-if="selectedFacility">
        <div class="facility-info">
          <h3>{{ selectedFacility.name }}</h3>
          <p>{{ selectedFacility.address }}</p>
        </div>
        
        <el-divider />
        
        <div class="feedback-list">
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
              <div class="feedback-date">{{ feedback.submitted_at }}</div>
            </div>
            <div class="feedback-content">{{ feedback.content }}</div>
          </div>
          
          <div v-if="facilityFeedbacks.length === 0" class="empty-feedback">
            <el-empty description="暂无评价" />
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AmapUtils } from '@/utils/map'

export default {
  name: 'FacilityManagement',
  setup() {
    const store = useStore()
    
    const loading = ref(false)
    const saveLoading = ref(false)
    const facilities = ref([])
    const selectedFacilities = ref([])
    const facilityDialogVisible = ref(false)
    const feedbackDialogVisible = ref(false)
    const isEdit = ref(false)
    const selectedFacility = ref(null)
    const facilityFeedbacks = ref([])
    
    // 搜索和过滤
    const searchKeyword = ref('')
    const selectedCategory = ref('')
    const currentPage = ref(1)
    const pageSize = ref(20)
    const total = ref(0)
    
    // 统计数据
    const stats = ref({
      total: 0,
      withFeedback: 0,
      categories: 0,
      lastWeek: 0
    })
    
    // 表单
    const facilityFormRef = ref()
    const facilityForm = reactive({
      facility_id: null,
      name: '',
      category_code: [],
      address: '',
      longitude: null,
      latitude: null
    })
    
    const facilityRules = {
      name: [
        { required: true, message: '请输入设施名称', trigger: 'blur' }
      ],
      category_code: [
        { required: true, message: '请选择设施分类', trigger: 'change' }
      ],
      address: [
        { required: true, message: '请输入详细地址', trigger: 'blur' }
      ],
      longitude: [
        { required: true, message: '请输入经度', trigger: 'blur' }
      ],
      latitude: [
        { required: true, message: '请输入纬度', trigger: 'blur' }
      ]
    }
    
    const cascaderProps = {
      value: 'category_code',
      label: 'category_name',
      children: 'children',
      checkStrictly: true
    }
    
    const facilityCategories = computed(() => store.getters['facilities/categoriesTree'])
    
    // 加载设施列表
    const loadFacilities = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          pageSize: pageSize.value,
          keyword: searchKeyword.value,
          category: selectedCategory.value
        }
        
        // 模拟API调用
        const mockData = generateMockFacilities()
        facilities.value = mockData.facilities
        total.value = mockData.total
        
        // 更新统计数据
        stats.value = {
          total: mockData.total,
          withFeedback: Math.floor(mockData.total * 0.6),
          categories: facilityCategories.value.length,
          lastWeek: Math.floor(Math.random() * 50) + 10
        }
      } catch (error) {
        ElMessage.error('加载设施列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 生成模拟数据
    const generateMockFacilities = () => {
      const mockFacilities = []
      const categories = [
        { code: '060200', name: '便利店' },
        { code: '060400', name: '超市' },
        { code: '090300', name: '诊所' },
        { code: '050300', name: '快餐厅' },
        { code: '150700', name: '公交站' }
      ]
      
      for (let i = 1; i <= 100; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)]
        mockFacilities.push({
          facility_id: i,
          name: `${category.name}${i}`,
          category_code: category.code,
          category_name: category.name,
          address: `上海市徐汇区某街道${i}号`,
          longitude: 121.4 + Math.random() * 0.1,
          latitude: 31.2 + Math.random() * 0.1,
          average_score: Math.random() > 0.3 ? (Math.random() * 2 + 3).toFixed(1) : null,
          feedback_count: Math.random() > 0.3 ? Math.floor(Math.random() * 20) + 1 : 0,
          last_updated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
        })
      }
      
      return {
        facilities: mockFacilities.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value),
        total: mockFacilities.length
      }
    }
    
    // 搜索处理
    const handleSearch = () => {
      currentPage.value = 1
      loadFacilities()
    }
    
    // 分类过滤
    const handleCategoryFilter = () => {
      currentPage.value = 1
      loadFacilities()
    }
    
    // 分页处理
    const handleSizeChange = (size) => {
      pageSize.value = size
      loadFacilities()
    }
    
    const handleCurrentChange = (page) => {
      currentPage.value = page
      loadFacilities()
    }
    
    // 选择变化
    const handleSelectionChange = (selection) => {
      selectedFacilities.value = selection
    }
    
    // 显示添加弹窗
    const showAddDialog = () => {
      isEdit.value = false
      facilityDialogVisible.value = true
    }
    
    // 编辑设施
    const editFacility = (facility) => {
      isEdit.value = true
      facilityForm.facility_id = facility.facility_id
      facilityForm.name = facility.name
      facilityForm.category_code = [facility.category_code]
      facilityForm.address = facility.address
      facilityForm.longitude = facility.longitude
      facilityForm.latitude = facility.latitude
      facilityDialogVisible.value = true
    }
    
    // 查看评价
    const viewFeedbacks = async (facility) => {
      selectedFacility.value = facility
      feedbackDialogVisible.value = true
      
      // 模拟加载评价数据
      facilityFeedbacks.value = [
        {
          feedback_id: 1,
          username: '张三',
          score: 4,
          content: '服务很好，位置便利',
          submitted_at: '2023-12-01 14:30'
        },
        {
          feedback_id: 2,
          username: '李四',
          score: 5,
          content: '非常满意，推荐！',
          submitted_at: '2023-12-02 09:15'
        }
      ]
    }
    
    // 删除设施
    const deleteFacility = async (facility) => {
      try {
        // 调用删除API
        ElMessage.success('删除成功')
        loadFacilities()
      } catch (error) {
        ElMessage.error('删除失败')
      }
    }
    
    // 地理编码
    const geocodeAddress = async () => {
      if (!facilityForm.address) return
      
      try {
        const result = await AmapUtils.geocode(facilityForm.address)
        facilityForm.longitude = result.longitude
        facilityForm.latitude = result.latitude
      } catch (error) {
        console.error('地理编码失败:', error)
      }
    }
    
    // 保存设施
    const saveFacility = async () => {
      if (!facilityFormRef.value) return
      
      try {
        await facilityFormRef.value.validate()
        saveLoading.value = true
        
        const facilityData = {
          ...facilityForm,
          category_code: facilityForm.category_code[facilityForm.category_code.length - 1]
        }
        
        // 调用保存API
        if (isEdit.value) {
          // 更新
          ElMessage.success('更新成功')
        } else {
          // 添加
          ElMessage.success('添加成功')
        }
        
        facilityDialogVisible.value = false
        loadFacilities()
      } catch (error) {
        console.error('保存失败:', error)
      } finally {
        saveLoading.value = false
      }
    }
    
    // 重置表单
    const resetFacilityForm = () => {
      facilityFormRef.value?.resetFields()
      Object.keys(facilityForm).forEach(key => {
        if (Array.isArray(facilityForm[key])) {
          facilityForm[key] = []
        } else {
          facilityForm[key] = null
        }
      })
    }
    
    // 批量导入
    const batchImport = () => {
      ElMessage.info('批量导入功能开发中...')
    }
    
    // 导出数据
    const exportData = () => {
      ElMessage.info('数据导出功能开发中...')
    }
    
    onMounted(() => {
      store.dispatch('facilities/fetchCategories')
      loadFacilities()
    })
    
    return {
      loading,
      saveLoading,
      facilities,
      selectedFacilities,
      facilityDialogVisible,
      feedbackDialogVisible,
      isEdit,
      selectedFacility,
      facilityFeedbacks,
      searchKeyword,
      selectedCategory,
      currentPage,
      pageSize,
      total,
      stats,
      facilityFormRef,
      facilityForm,
      facilityRules,
      cascaderProps,
      facilityCategories,
      loadFacilities,
      handleSearch,
      handleCategoryFilter,
      handleSizeChange,
      handleCurrentChange,
      handleSelectionChange,
      showAddDialog,
      editFacility,
      viewFeedbacks,
      deleteFacility,
      geocodeAddress,
      saveFacility,
      resetFacilityForm,
      batchImport,
      exportData
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
  margin-bottom: 16px;
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

.rating-text {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.no-rating {
  color: #c0c4cc;
  font-size: 12px;
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
  color: #666;
  line-height: 1.6;
}

.empty-feedback {
  text-align: center;
  padding: 40px 20px;
}

@media (max-width: 768px) {
  .facility-management-container {
    margin: 0 16px;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 16px;
  }
  
  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: center;
  }
  
  .toolbar-right {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
