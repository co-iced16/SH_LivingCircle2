/**
 * 设施导入配置文件
 * 可以根据需要调整搜索参数
 */

const IMPORT_MODES = {
  // 快速模式：每个分类只获取1页数据（50个POI）
  QUICK: {
    MAX_PAGES: 1,
    DESCRIPTION: '快速导入，每分类最多50个设施'
  },
  
  // 标准模式：每个分类获取5页数据（250个POI）
  STANDARD: {
    MAX_PAGES: 5,
    DESCRIPTION: '标准导入，每分类最多250个设施'
  },
  
  // 深度模式：每个分类获取10页数据（500个POI）
  DEEP: {
    MAX_PAGES: 10,
    DESCRIPTION: '深度导入，每分类最多500个设施'
  },
  
  // 完整模式：每个分类获取20页数据（1000个POI）
  FULL: {
    MAX_PAGES: 20,
    DESCRIPTION: '完整导入，每分类最多1000个设施'
  },
  
  // 最大模式：获取尽可能多的数据
  MAX: {
    MAX_PAGES: 500, // 单次搜索最多50页
    DESCRIPTION: '最大导入，每分类最多2500个设施'
  }
};

module.exports = {
  IMPORT_MODES
};
