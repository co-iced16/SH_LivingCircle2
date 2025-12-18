// 日志工具 - 根据环境变量控制日志级别
const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  // 调试日志 - 仅在开发环境输出
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  // 信息日志
  info: (...args) => {
    console.log('[INFO]', ...args);
  },

  // 警告日志
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },

  // 错误日志
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },

  // SQL日志 - 仅在开发环境输出
  sql: (sql, params) => {
    if (isDevelopment) {
      console.log('[SQL]', sql);
      if (params && params.length > 0) {
        console.log('[PARAMS]', params);
      }
    }
  }
};

module.exports = logger;
