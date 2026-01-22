/**
 * Login Page
 *
 * API key authentication with styling matching Electron app.
 */

import React, { useState } from 'react'
import { useAuth } from '../contexts/PlatformContext'
import { Spinner } from '@craft-agent/ui'

export function LoginPage() {
  const { login } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(apiKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <CraftAgentLogo className="w-16 h-16 text-accent mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Craft Agents</h1>
          <p className="text-foreground-50">Web Edition</p>
        </div>

        {/* Login form */}
        <div className="bg-foreground-2 rounded-xl p-6 shadow-middle">
          <h2 className="text-xl font-semibold text-foreground mb-4">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-foreground mb-2">
                Anthropic API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full px-4 py-3 rounded-lg bg-foreground/5 border border-foreground/10 text-foreground placeholder:text-foreground-30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                required
                autoFocus
              />
              <p className="text-xs text-foreground-40 mt-2">
                Your API key is stored locally and used to authenticate with Claude.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="w-full px-4 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-minimal flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Spinner className="text-sm" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-foreground-40 mt-6">
          Don't have an API key?{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Get one from Anthropic
          </a>
        </p>
      </div>
    </div>
  )
}

/**
 * Craft Agent Logo
 */
function CraftAgentLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(3.4502, 3)" fill="currentColor">
        <path
          d="M3.17890888,3.6 L3.17890888,0 L16,0 L16,3.6 L3.17890888,3.6 Z M9.642,7.2 L9.64218223,10.8 L0,10.8 L0,3.6 L16,3.6 L16,7.2 L9.642,7.2 Z M3.17890888,18 L3.178,14.4 L0,14.4 L0,10.8 L16,10.8 L16,18 L3.17890888,18 Z"
          fillRule="nonzero"
        />
      </g>
    </svg>
  )
}
