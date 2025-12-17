const { pool } = require('../config/database');

/**
 * 将高德地图的分类代码映射到我们系统的分类代码
 * @param {string} amapTypecode 高德地图的分类代码
 * @param {Set} validCategoryCodes 我们系统中有效的分类代码集合（可选）
 * @returns {Promise<string|null>} 映射后的分类代码，如果无法映射则返回null
 */
const mapAmapTypeToOurCategory = async (amapTypecode, validCategoryCodes = null) => {
  if (!amapTypecode) return null;
  
  // 如果没有提供有效分类代码集合，则获取
  if (!validCategoryCodes) {
    validCategoryCodes = await getValidCategoryCodes();
  }
  
  // 直接匹配：如果高德的分类代码在我们系统中存在
  if (validCategoryCodes.has(amapTypecode)) {
    return amapTypecode;
  }
  
  // 层级匹配：寻找最具体的父级分类
  // 例如：050102 (四川菜) -> 050100 (中餐厅) -> 050000 (餐饮服务)
  
  // 尝试6位 -> 4位匹配 (三级 -> 二级)
  if (amapTypecode.length >= 6) {
    const level2Code = amapTypecode.substring(0, 4) + '00';
    if (validCategoryCodes.has(level2Code)) {
      return level2Code;
    }
  }
  
  // 尝试4位 -> 2位匹配 (二级 -> 一级) 
  if (amapTypecode.length >= 4) {
    const level1Code = amapTypecode.substring(0, 2) + '0000';
    if (validCategoryCodes.has(level1Code)) {
      return level1Code;
    }
  }
  
  return null;
};

/**
 * 获取所有有效的分类代码
 * @returns {Promise<Set>} 有效分类代码的集合
 */
const getValidCategoryCodes = async () => {
  const [validCategories] = await pool.execute('SELECT category_code FROM facility_categories');
  return new Set(validCategories.map(cat => cat.category_code));
};

/**
 * 验证并映射分类代码
 * @param {string} categoryCode 要验证的分类代码
 * @returns {Promise<{isValid: boolean, mappedCode: string|null, originalCode: string}>}
 */
const validateAndMapCategoryCode = async (categoryCode) => {
  const validCategoryCodes = await getValidCategoryCodes();
  const mappedCode = await mapAmapTypeToOurCategory(categoryCode, validCategoryCodes);
  
  return {
    isValid: mappedCode !== null,
    mappedCode: mappedCode,
    originalCode: categoryCode
  };
};

module.exports = {
  mapAmapTypeToOurCategory,
  getValidCategoryCodes,
  validateAndMapCategoryCode
};
