/**
 * Platform Context
 *
 * Provides the platform API and capabilities to all React components.
 * This allows components to be platform-agnostic while still accessing
 * platform-specific features when needed.
 */

import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react'
import type { PlatformAPI, PlatformCapabilities, PlatformContext as IPlatformContext } from '@craft-agent/shared/platform'
import { WebPlatformAPI, webCapabilities } from '@craft-agent/shared/platform/web'

// API base URL - uses environment variable in production, /api proxy in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create context
const PlatformContext = createContext<IPlatformContext | null>(null)

// Auth context for managing authentication state
interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
  login: (apiKey: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Platform Provider Component
 *
 * Wraps the app and provides platform API access to all children.
 */
export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    // Try to restore token from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('craft-agents-token')
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(true)

  // Create platform API instance
  const api = useMemo(() => {
    const webApi = new WebPlatformAPI({
      baseUrl: API_BASE_URL,
    })
    // Set token if available
    if (token) {
      webApi.setAuthToken(token)
    }
    return webApi
  }, []) // Only create once

  // Update token on API when it changes
  useEffect(() => {
    api.setAuthToken(token)
    if (token) {
      api.connectWebSocket()
    } else {
      api.disconnectWebSocket()
    }
  }, [api, token])

  // Check auth state on mount
  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          await api.getAuthState()
          // Token is valid
        } catch {
          // Token is invalid, clear it
          setToken(null)
          localStorage.removeItem('craft-agents-token')
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [api, token])

  // Login function
  const login = useCallback(async (apiKey: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    setToken(data.token)
    localStorage.setItem('craft-agents-token', data.token)
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Ignore errors
    }
    setToken(null)
    localStorage.removeItem('craft-agents-token')
  }, [api])

  // Memoize context values
  const platformContext = useMemo<IPlatformContext>(() => ({
    api,
    capabilities: webCapabilities,
  }), [api])

  const authContext = useMemo<AuthContextValue>(() => ({
    isAuthenticated: !!token,
    isLoading,
    token,
    login,
    logout,
  }), [token, isLoading, login, logout])

  return (
    <PlatformContext.Provider value={platformContext}>
      <AuthContext.Provider value={authContext}>
        {children}
      </AuthContext.Provider>
    </PlatformContext.Provider>
  )
}

/**
 * Hook to access the platform context
 */
export function usePlatform(): IPlatformContext {
  const context = useContext(PlatformContext)
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider')
  }
  return context
}

/**
 * Hook to access just the platform API
 */
export function usePlatformAPI(): PlatformAPI {
  return usePlatform().api
}

/**
 * Hook to access platform capabilities
 */
export function usePlatformCapabilities(): PlatformCapabilities {
  return usePlatform().capabilities
}

/**
 * Hook to access auth state and functions
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within PlatformProvider')
  }
  return context
}
