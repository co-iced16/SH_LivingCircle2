import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './assets/styles/global.css'

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 全局错误处理：抑制 ResizeObserver 警告
// 这是一个常见的浏览器警告，通常由 ECharts 等图表库触发，不影响功能
const originalError = window.console.error
window.console.error = (...args) => {
  // 过滤掉 ResizeObserver 相关的警告
  if (
    args.length > 0 &&
    typeof args[0] === 'string' &&
    (args[0].includes('ResizeObserver loop') ||
     args[0].includes('ResizeObserver loop completed with undelivered notifications'))
  ) {
    // 静默处理，不输出到控制台
    return
  }
  // 其他错误正常输出
  originalError.apply(console, args)
}

// 处理未捕获的 Promise 错误中的 ResizeObserver 警告
window.addEventListener('error', (event) => {
  if (
    event.message &&
    (event.message.includes('ResizeObserver loop') ||
     event.message.includes('ResizeObserver loop completed with undelivered notifications'))
  ) {
    event.preventDefault()
    event.stopPropagation()
    return false
  }
})

// 处理未处理的 Promise 拒绝中的 ResizeObserver 警告
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    typeof event.reason === 'string' &&
    (event.reason.includes('ResizeObserver loop') ||
     event.reason.includes('ResizeObserver loop completed with undelivered notifications'))
  ) {
    event.preventDefault()
    return false
  }
})

app.use(store)
   .use(router)
   .use(ElementPlus)
   .mount('#app')
