import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')

// 全局错误捕获
window.addEventListener('error', (e) => {
  if (root) {
    root.innerHTML = `<div style="color:red;padding:20px;font-family:monospace;">
      <h2>加载错误</h2>
      <pre>${e.message}\n\n${e.filename || ''}\n行 ${e.lineno}:${e.colno}</pre>
    </div>`
  }
})

window.addEventListener('unhandledrejection', (e) => {
  if (root) {
    root.innerHTML = `<div style="color:red;padding:20px;font-family:monospace;">
      <h2>Promise 错误</h2>
      <pre>${String(e.reason)}</pre>
    </div>`
  }
})

if (root) {
  createRoot(root).render(<App />)
}
