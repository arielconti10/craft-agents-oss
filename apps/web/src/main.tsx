import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { PlatformProvider } from './contexts/PlatformContext'
import './index.css'

// Detect system dark mode and apply class to html element
function setupTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark)

  // Listen for changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    document.documentElement.classList.toggle('dark', e.matches)
  })
}

setupTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlatformProvider>
      <App />
    </PlatformProvider>
  </React.StrictMode>
)
