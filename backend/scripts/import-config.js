/**
 * 设施数据导入配置文件
 * 包含搜索策略、API限制等参数
 * 适配当前数据库结构 (locations, facilities, facility_categories)
 */

// 导入配置
const IMPORT_CONFIG = {
  // API请求限制
  API_LIMITS: {
    REQUEST_DELAY: 500,        // 每次请求间隔(毫秒)
    BATCH_DELAY: 2000,         // 每批次间隔(毫秒)
    BATCH_SIZE: 5,             // 每批次处理的分类数量
    RETRY_ATTEMPTS: 3,         // 重试次数
    TIMEOUT: 15000             // 请求超时时间(毫秒)
  },

  // 搜索参数
  SEARCH_CONFIG: {
    RADIUS: 3000,              // 搜索半径(米)
    MAX_RESULTS_PER_REQUEST: 20, // 每次请求最大结果数
    MAX_PAGES: 1,              // 最大页数
    CITY: '上海',              // 搜索城市
    CITY_CODE: '310000'        // 上海市行政区划代码
  },

  // 数据过滤配置
  DATA_FILTER: {
    MIN_NAME_LENGTH: 2,        // 设施名称最小长度
    MAX_NAME_LENGTH: 100,      // 设施名称最大长度
    MIN_ADDRESS_LENGTH: 5,     // 地址最小长度
    REQUIRED_ADDRESS_KEYWORDS: ['上海'], // 地址必须包含的关键词
    EXCLUDED_NAME_KEYWORDS: [   // 排除的设施名称关键词
      '测试', 'test', '临时', '已关闭', '已停业'
    ]
  },

  // 日志配置
  LOGGING: {
    ENABLE_VERBOSE: true,      // 启用详细日志
    LOG_INTERVAL: 100,         // 每处理多少条数据记录一次进度
    ENABLE_STATS: true         // 启用统计信息
  }
};

// 优先级分类 (优先导入的分类，按重要性排序)
const PRIORITY_CATEGORIES = [
  // 高优先级 - 日常必需
  '060200', // 便利店
  '060400', // 超级市场
  '090100', // 综合医院
  '090300', // 诊所
  '090600', // 药店
  '141203', // 小学
  '141204', // 幼儿园
  '150700', // 公交车站
  '150501', // 地铁站
  '160100', // 银行
  '160300', // ATM
  
  // 中优先级 - 常用服务
  '050100', // 中餐厅
  '050300', // 快餐厅
  '050500', // 咖啡厅
  '071100', // 美容美发店
  '070400', // 邮局
  '150900', // 停车场
  '010100', // 加油站
  
  // 低优先级 - 其他服务
  '050200', // 外国餐厅
  '080100', // 运动场馆
  '080600', // 影剧院
  '061100', // 服装店
  '061400', // 化妆品店
];

// 区域搜索配置 - 基于上海市16个行政区
const SHANGHAI_DISTRICTS = [
  // 中心城区（7个）
  { name: '黄浦区', lng: 121.484443, lat: 31.231763, adcode: '310101', priority: 1 },
  { name: '徐汇区', lng: 121.436525, lat: 31.179973, adcode: '310104', priority: 1 },
  { name: '长宁区', lng: 121.4235, lat: 31.220367, adcode: '310105', priority: 1 },
  { name: '静安区', lng: 121.448224, lat: 31.229003, adcode: '310106', priority: 1 },
  { name: '普陀区', lng: 121.392499, lat: 31.249162, adcode: '310107', priority: 1 },
  { name: '虹口区', lng: 121.491832, lat: 31.26097, adcode: '310109', priority: 1 },
  { name: '杨浦区', lng: 121.526443, lat: 31.259056, adcode: '310110', priority: 1 },
  
  // 新城区（4个）
  { name: '浦东新区', lng: 121.544379, lat: 31.221517, adcode: '310115', priority: 2 },
  { name: '闵行区', lng: 121.375972, lat: 31.112813, adcode: '310112', priority: 2 },
  { name: '宝山区', lng: 121.489934, lat: 31.398896, adcode: '310113', priority: 2 },
  { name: '嘉定区', lng: 121.250333, lat: 31.383524, adcode: '310114', priority: 2 },
  
  // 远郊区（5个）
  { name: '松江区', lng: 121.223543, lat: 31.03047, adcode: '310117', priority: 3 },
  { name: '青浦区', lng: 121.113021, lat: 31.151209, adcode: '310118', priority: 3 },
  { name: '奉贤区', lng: 121.458472, lat: 30.912345, adcode: '310120', priority: 3 },
  { name: '金山区', lng: 121.330736, lat: 30.724697, adcode: '310116', priority: 3 },
  { name: '崇明区', lng: 121.397516, lat: 31.626946, adcode: '310151', priority: 3 }
];

// 批量导入策略
const BATCH_IMPORT_STRATEGY = {
  // 第一轮：高优先级分类 + 主城区
  PHASE_1: {
    categories: PRIORITY_CATEGORIES.slice(0, 11), // 前11个高优先级分类
    regions: SHANGHAI_DISTRICTS.filter(r => r.priority === 1), // 主城区
    description: '第一轮：核心区域核心设施'
  },
  
  // 第二轮：中优先级分类 + 新城区
  PHASE_2: {
    categories: PRIORITY_CATEGORIES.slice(11, 18), // 中优先级分类
    regions: SHANGHAI_DISTRICTS.filter(r => r.priority <= 2), // 主城区+新城区
    description: '第二轮：扩展区域常用设施'
  },
  
  // 第三轮：低优先级分类 + 全市
  PHASE_3: {
    categories: PRIORITY_CATEGORIES.slice(18), // 剩余分类
    regions: SHANGHAI_DISTRICTS, // 全市
    description: '第三轮：全市范围其他设施'
  }
};

// 高德API搜索关键词映射
const SEARCH_KEYWORDS = {
  '050100': ['中餐厅', '中餐', '川菜', '粤菜', '湘菜', '鲁菜', '苏菜', '浙菜', '闽菜', '徽菜'],
  '050200': ['西餐厅', '西餐', '日料', '韩料', '泰菜', '意大利菜', '法餐'],
  '050300': ['快餐', '麦当劳', '肯德基', '汉堡王', '必胜客', '德克士', '沙县小吃'],
  '050500': ['咖啡厅', '咖啡', '星巴克', '瑞幸咖啡', 'costa'],
  '050600': ['茶艺馆', '茶楼', '茶室'],
  '050700': ['冷饮店', '奶茶', '果汁', '饮品'],
  '050800': ['糕饼店', '面包房', '蛋糕店', '烘焙'],
  
  '060100': ['商场', '购物中心', '百货', '万达', '恒隆', '来福士'],
  '060200': ['便利店', '7-11', '全家', '罗森', 'OK便利店'],
  '060300': ['家电', '电器', '苏宁', '国美', '五星电器'],
  '060400': ['超市', '大润发', '家乐福', '沃尔玛', '联华', '华润万家'],
  '060800': ['文化用品', '文具店', '书店'],
  '060900': ['体育用品', '运动用品', '迪卡侬'],
  '061100': ['服装店', '服饰', '优衣库', 'H&M', 'ZARA'],
  '061400': ['化妆品', '护肤品', '屈臣氏', '丝芙兰'],
  '061205': ['书店', '新华书店', '当当书店'],
  
  '070400': ['邮局', '中国邮政'],
  '071100': ['美容美发', '理发店', '美发', '美容院'],
  '071300': ['摄影', '冲印', '照相馆'],
  '071500': ['洗衣店', '干洗', '洗衣'],
  '070601': ['电信营业厅', '中国电信'],
  '070602': ['移动营业厅', '中国移动'],
  '070603': ['联通营业厅', '中国联通'],
  
  '090100': ['综合医院', '医院', '三甲医院'],
  '090300': ['诊所', '卫生所', '社区医院'],
  '090600': ['药店', '药房'],
  '090202': ['口腔医院', '牙科'],
  '090203': ['眼科医院', '眼科'],
  
  '140500': ['图书馆'],
  '141202': ['中学', '高中', '初中'],
  '141203': ['小学'],
  '141204': ['幼儿园'],
  
  '080100': ['运动场馆', '体育馆', '健身房', '游泳馆'],
  '080300': ['娱乐场所', 'KTV', '网吧'],
  '080600': ['电影院', '影院', '剧院'],
  
  '150202': ['火车站', '高铁站'],
  '150501': ['地铁站'],
  '150700': ['公交站'],
  '150900': ['停车场'],
  
  '160100': ['银行', '工商银行', '建设银行', '农业银行', '中国银行'],
  '160300': ['ATM', '自动提款机'],
  
  '010100': ['加油站', '中石油', '中石化'],
  '010400': ['汽修', '汽车维修', '汽车美容']
};

// 搜索策略配置
const SEARCH_STRATEGY = {
  // 优先使用关键词搜索（精准匹配）
  PRIMARY: 'keywords',
  // 备用分类名称搜索（全覆盖）  
  FALLBACK: 'category_name',
  // 混合模式（既用关键词也用分类名称）
  HYBRID: 'hybrid'
};

// 自动生成分类名称搜索关键词
function generateCategoryKeywords(categoryName) {
  // 清理分类名称，生成搜索关键词
  const cleanName = categoryName
    .replace(/^.*?-/, '')           // 移除前缀 "餐饮服务-" 
    .replace(/服务$/, '')           // 移除后缀 "服务"
    .replace(/场所$/, '')           // 移除后缀 "场所"
    .trim();
  
  const keywords = [cleanName];
  
  // 根据分类特点添加同义词
  const synonyms = {
    '中餐厅': ['中餐', '中式餐厅'],
    '便利店': ['便利', '超市便利'],
    '综合医院': ['医院', '大医院'],
    '小学': ['小学校'],
    '幼儿园': ['幼儿园所', '托儿所'],
    '停车场': ['停车位', '车库'],
    '加油站': ['油站', '汽油站']
  };
  
  if (synonyms[cleanName]) {
    keywords.push(...synonyms[cleanName]);
  }
  
  return keywords;
}

// 验证配置
function validateConfig() {
  const errors = [];
  
  if (!process.env.AMAP_API_KEY) {
    errors.push('缺少高德API密钥 (AMAP_API_KEY)');
  }
  
  if (!process.env.DB_HOST) {
    errors.push('缺少数据库主机配置 (DB_HOST)');
  }
  
  if (!process.env.DB_PASSWORD) {
    errors.push('缺少数据库密码配置 (DB_PASSWORD)');
  }
  
  return errors;
}

module.exports = {
  IMPORT_CONFIG,
  PRIORITY_CATEGORIES,
  SHANGHAI_DISTRICTS,
  BATCH_IMPORT_STRATEGY,
  SEARCH_KEYWORDS,
  SEARCH_STRATEGY,
  generateCategoryKeywords,
  validateConfig
};
