import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { PlatformProvider } from './contexts/PlatformContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlatformProvider>
      <App />
    </PlatformProvider>
  </React.StrictMode>
)
