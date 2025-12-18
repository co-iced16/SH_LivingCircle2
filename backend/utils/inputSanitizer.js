// 输入清理工具 - 防止XSS和其他注入攻击

/**
 * 清理字符串输入
 * @param {string} input - 输入字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 清理后的字符串
 */
const sanitizeString = (input, maxLength = 1000) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  // 移除控制字符，保留换行和制表符
  let cleaned = input
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  
  // 限制长度
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }
  
  return cleaned;
};

/**
 * 验证并清理数字
 * @param {any} input - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number|null} 清理后的数字或null
 */
const sanitizeNumber = (input, min = -Infinity, max = Infinity) => {
  const num = typeof input === 'number' ? input : parseFloat(input);
  
  if (isNaN(num)) {
    return null;
  }
  
  if (num < min || num > max) {
    return null;
  }
  
  return num;
};

/**
 * 验证并清理整数
 * @param {any} input - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number|null} 清理后的整数或null
 */
const sanitizeInteger = (input, min = -Infinity, max = Infinity) => {
  const num = sanitizeNumber(input, min, max);
  
  if (num === null) {
    return null;
  }
  
  return Math.floor(num);
};

/**
 * 验证并清理数组
 * @param {any} input - 输入值
 * @param {Function} itemValidator - 项目验证函数
 * @param {number} maxLength - 最大长度
 * @returns {Array} 清理后的数组
 */
const sanitizeArray = (input, itemValidator = null, maxLength = 100) => {
  if (!Array.isArray(input)) {
    return [];
  }
  
  let cleaned = input.slice(0, maxLength);
  
  if (itemValidator) {
    cleaned = cleaned.filter(item => itemValidator(item));
  }
  
  return cleaned;
};

/**
 * 验证坐标
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @returns {boolean} 是否有效
 */
const validateCoordinates = (longitude, latitude) => {
  return (
    typeof longitude === 'number' &&
    typeof latitude === 'number' &&
    longitude >= -180 && longitude <= 180 &&
    latitude >= -90 && latitude <= 90
  );
};

module.exports = {
  sanitizeString,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeArray,
  validateCoordinates
};
