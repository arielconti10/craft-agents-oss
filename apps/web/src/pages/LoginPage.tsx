/**
 * Login Page
 *
 * Simple login form for API key authentication.
 */

import React, { useState } from 'react'
import { useAuth } from '../contexts/PlatformContext'

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Craft Agents</h1>
          <p className="text-[var(--color-muted)]">Web Edition</p>
        </div>

        {/* Login form */}
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
                Anthropic API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                required
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Your API key is used to authenticate with the Anthropic API.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[var(--color-destructive)] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !apiKey}
              className="w-full px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[var(--color-muted)] mt-6">
          Don't have an API key?{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Get one from Anthropic
          </a>
        </p>
      </div>
    </div>
  )
}
