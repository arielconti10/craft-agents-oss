/**
 * Source Detail Page
 *
 * Displays comprehensive information about a source:
 * - Connection info (type, URL, status)
 * - Available MCP tools with permission status
 * - Configuration details
 * - OAuth/credential status
 */

import React, { useState, useEffect, useCallback } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import type { LoadedSource } from '@craft-agent/shared/sources/types'
import { Spinner } from '@craft-agent/ui'
import {
  Plug,
  Globe,
  Terminal,
  Key,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Shield,
  ExternalLink,
  Server,
  FileText,
} from 'lucide-react'

interface SourceDetailPageProps {
  source: LoadedSource
  workspaceId: string | null
  onRefresh?: () => void
}

interface McpTool {
  name: string
  description?: string
  allowed: boolean
}

export function SourceDetailPage({ source, workspaceId, onRefresh }: SourceDetailPageProps) {
  const api = usePlatformAPI()

  // Tools state
  const [tools, setTools] = useState<McpTool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [toolsError, setToolsError] = useState<string | null>(null)

  // OAuth state
  const [isStartingOAuth, setIsStartingOAuth] = useState(false)

  // Load MCP tools
  useEffect(() => {
    if (workspaceId && source.config.slug) {
      setIsLoadingTools(true)
      setToolsError(null)
      api.getMcpTools(workspaceId, source.config.slug)
        .then(result => {
          if (result.success && result.tools) {
            setTools(result.tools)
          } else if (result.error) {
            setToolsError(result.error)
          }
        })
        .catch(err => {
          setToolsError(err.message || 'Failed to load tools')
        })
        .finally(() => setIsLoadingTools(false))
    }
  }, [api, workspaceId, source.config.slug])

  // Start OAuth flow
  const handleStartOAuth = useCallback(async () => {
    if (!workspaceId) return

    setIsStartingOAuth(true)
    try {
      const result = await api.startSourceOAuth(workspaceId, source.config.slug)
      if (result.success) {
        // Refresh source to get updated status
        onRefresh?.()
      } else if (result.error) {
        console.error('OAuth failed:', result.error)
      }
    } catch (error) {
      console.error('OAuth error:', error)
    } finally {
      setIsStartingOAuth(false)
    }
  }, [api, workspaceId, source.config.slug, onRefresh])

  // Get source type info
  const getSourceTypeInfo = () => {
    const { type, mcp, api: apiConfig } = source.config
    if (type === 'mcp') {
      const transport = mcp?.transport || 'http'
      return {
        icon: transport === 'stdio' ? Terminal : Server,
        label: transport === 'stdio' ? 'Local MCP Server' : 'Remote MCP Server',
        detail: transport === 'stdio' ? mcp?.command : mcp?.url,
      }
    } else if (type === 'api') {
      return {
        icon: Globe,
        label: 'REST API',
        detail: apiConfig?.baseUrl,
      }
    } else {
      return {
        icon: FileText,
        label: 'Local Source',
        detail: source.config.local?.path,
      }
    }
  }

  // Get connection status info
  const getStatusInfo = () => {
    const status = source.config.connectionStatus || 'untested'
    switch (status) {
      case 'connected':
        return { icon: Check, label: 'Connected', color: 'text-success', bgColor: 'bg-success/10' }
      case 'needs_auth':
        return { icon: Key, label: 'Needs Authentication', color: 'text-warning', bgColor: 'bg-warning/10' }
      case 'failed':
        return { icon: X, label: 'Connection Failed', color: 'text-destructive', bgColor: 'bg-destructive/10' }
      case 'local_disabled':
        return { icon: AlertTriangle, label: 'Local MCP Disabled', color: 'text-foreground-50', bgColor: 'bg-foreground/10' }
      default:
        return { icon: RefreshCw, label: 'Not Tested', color: 'text-foreground-50', bgColor: 'bg-foreground/10' }
    }
  }

  // Get auth type display
  const getAuthInfo = () => {
    const { type, mcp, api: apiConfig } = source.config
    if (type === 'mcp') {
      const authType = mcp?.authType || 'none'
      if (authType === 'oauth') return { label: 'OAuth', needsSetup: !source.config.isAuthenticated }
      if (authType === 'bearer') return { label: 'Bearer Token', needsSetup: !source.config.isAuthenticated }
      return { label: 'No Authentication', needsSetup: false }
    } else if (type === 'api') {
      const authType = apiConfig?.authType || 'none'
      const labels: Record<string, string> = {
        bearer: 'Bearer Token',
        header: `Header (${apiConfig?.headerName || 'X-API-Key'})`,
        query: `Query (${apiConfig?.queryParam || 'api_key'})`,
        basic: 'Basic Auth',
        none: 'No Authentication',
      }
      return { label: labels[authType] || 'Unknown', needsSetup: authType !== 'none' && !source.config.isAuthenticated }
    }
    return { label: 'None', needsSetup: false }
  }

  const typeInfo = getSourceTypeInfo()
  const statusInfo = getStatusInfo()
  const authInfo = getAuthInfo()
  const TypeIcon = typeInfo.icon
  const StatusIcon = statusInfo.icon

  // Count allowed/blocked tools
  const allowedTools = tools.filter(t => t.allowed).length
  const blockedTools = tools.filter(t => !t.allowed).length

  return (
    <div className="flex-1 bg-foreground-1.5 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            {source.config.icon && /^\p{Emoji}/u.test(source.config.icon) ? (
              <span className="text-2xl">{source.config.icon}</span>
            ) : (
              <Plug className="w-7 h-7 text-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{source.config.name}</h1>
            <p className="text-foreground-50 capitalize">{source.config.provider}</p>
            {source.config.tagline && (
              <p className="text-foreground-70 text-sm mt-1">{source.config.tagline}</p>
            )}
          </div>
          {/* Status badge */}
          <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${statusInfo.bgColor}`}>
            <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
            <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
        </div>

        {/* Connection Error */}
        {source.config.connectionError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Connection Error</p>
              <p className="text-sm text-destructive/80 mt-1">{source.config.connectionError}</p>
            </div>
          </div>
        )}

        {/* Connection Info Card */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-accent" />
            Connection
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-foreground/5">
              <span className="text-foreground-50">Type</span>
              <span className="text-foreground font-medium">{typeInfo.label}</span>
            </div>
            {typeInfo.detail && (
              <div className="flex items-center justify-between py-2 border-b border-foreground/5">
                <span className="text-foreground-50">
                  {source.config.type === 'mcp' && source.config.mcp?.transport === 'stdio' ? 'Command' : 'URL'}
                </span>
                <span className="text-foreground font-mono text-sm truncate max-w-[300px]" title={typeInfo.detail}>
                  {typeInfo.detail}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-foreground/5">
              <span className="text-foreground-50">Authentication</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground">{authInfo.label}</span>
                {authInfo.needsSetup && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">Setup Required</span>
                )}
              </div>
            </div>
            {source.config.lastTestedAt && (
              <div className="flex items-center justify-between py-2">
                <span className="text-foreground-50">Last Tested</span>
                <span className="text-foreground">
                  {new Date(source.config.lastTestedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* OAuth Button */}
          {authInfo.needsSetup && source.config.mcp?.authType === 'oauth' && (
            <button
              onClick={handleStartOAuth}
              disabled={isStartingOAuth}
              className="mt-4 w-full px-4 py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isStartingOAuth ? (
                <>
                  <Spinner className="text-sm" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>Connect with OAuth</span>
                </>
              )}
            </button>
          )}
        </section>

        {/* MCP Tools Card */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-5 h-5 text-accent" />
              Available Tools
            </h2>
            {tools.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-success">{allowedTools} allowed</span>
                {blockedTools > 0 && (
                  <span className="text-foreground-50">{blockedTools} blocked</span>
                )}
              </div>
            )}
          </div>

          {isLoadingTools ? (
            <div className="flex items-center gap-2 text-foreground-50 py-4">
              <Spinner className="text-sm" />
              <span>Loading tools...</span>
            </div>
          ) : toolsError ? (
            <div className="flex items-center gap-2 text-destructive py-4">
              <AlertTriangle className="w-4 h-4" />
              <span>{toolsError}</span>
            </div>
          ) : tools.length === 0 ? (
            <p className="text-foreground-40 text-sm py-4">
              No tools available. The source may need to be connected first.
            </p>
          ) : (
            <div className="space-y-2">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-start gap-3 p-3 rounded-lg bg-foreground/5 hover:bg-foreground/8 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    tool.allowed ? 'bg-success' : 'bg-foreground-30'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{tool.name}</span>
                      {!tool.allowed && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-foreground/10 text-foreground-50">
                          blocked
                        </span>
                      )}
                    </div>
                    {tool.description && (
                      <p className="text-sm text-foreground-50 mt-1">{tool.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Permissions Card */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Permissions
          </h2>
          <p className="text-foreground-50 text-sm">
            Tool permissions for this source are managed through the workspace permissions configuration.
            {allowedTools > 0 && ` Currently ${allowedTools} tools are allowed.`}
          </p>
          <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
            <p className="text-xs text-foreground-40">
              In the web version, permission rules are inherited from workspace defaults.
              Use the desktop app for advanced permission configuration.
            </p>
          </div>
        </section>

        {/* Guide/Documentation Card */}
        {source.guide?.raw && (
          <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Documentation
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="bg-foreground/5 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-foreground-70 whitespace-pre-wrap font-mono">
                  {source.guide.raw.slice(0, 2000)}
                  {source.guide.raw.length > 2000 && '...'}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* Source Info Footer */}
        <div className="text-xs text-foreground-40 space-y-1">
          <p>Source ID: {source.config.id}</p>
          <p>Slug: {source.config.slug}</p>
          {source.config.createdAt && (
            <p>Created: {new Date(source.config.createdAt).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}
