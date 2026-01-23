import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { SharedSessionPage } from './pages/SharedSessionPage'
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

/**
 * Simple URL-based router
 * Handles /share/:shareId routes for public shared session viewing
 */
function Router() {
  const [path, setPath] = React.useState(window.location.pathname)

  React.useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Check for shared session route: /share/:shareId
  const shareMatch = path.match(/^\/share\/([a-zA-Z0-9]+)$/)
  if (shareMatch && shareMatch[1]) {
    return <SharedSessionPage shareId={shareMatch[1]} />
  }

  // Default: main app with authentication
  return (
    <PlatformProvider>
      <App />
    </PlatformProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)
