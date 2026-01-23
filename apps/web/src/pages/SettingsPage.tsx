/**
 * Settings Page
 *
 * Manages app settings including:
 * - API key configuration
 * - Workspace settings (model, permission mode, thinking level)
 * - Skills and sources configuration
 * - Theme selection
 */

import React, { useState, useEffect, useCallback } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import { MODELS, DEFAULT_MODEL } from '@craft-agent/shared/config/models'
import { PERMISSION_MODE_CONFIG, type PermissionMode } from '@craft-agent/shared/agent/mode-types'
import { THINKING_LEVELS, type ThinkingLevel } from '@craft-agent/shared/agent/thinking-levels'
import type { BillingMethodInfo, WorkspaceSettings } from '@craft-agent/shared/platform'
import type { LoadedSkill } from '@craft-agent/shared/skills/types'
import type { LoadedSource } from '@craft-agent/shared/sources/types'
import { Spinner } from '@craft-agent/ui'
import {
  Key,
  Check,
  X,
  Eye,
  EyeOff,
  Palette,
  Bot,
  Settings,
  AlertTriangle,
  Shield,
  Brain,
  Briefcase,
  Wand2,
  Plug,
  Plus,
  ChevronRight,
} from 'lucide-react'

interface SettingsPageProps {
  workspaceId: string | null
}

export function SettingsPage({ workspaceId }: SettingsPageProps) {
  const api = usePlatformAPI()

  // Loading states
  const [isLoadingBilling, setIsLoadingBilling] = useState(true)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [isLoadingTheme, setIsLoadingTheme] = useState(true)
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true)
  const [isLoadingSkills, setIsLoadingSkills] = useState(true)
  const [isLoadingSources, setIsLoadingSources] = useState(true)

  // API Key state
  const [billingInfo, setBillingInfo] = useState<BillingMethodInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)

  // Model state
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [isSavingModel, setIsSavingModel] = useState(false)

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState('system')
  const [isSavingTheme, setIsSavingTheme] = useState(false)

  // Workspace settings state
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('ask')
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('think')
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false)

  // Skills and sources state
  const [skills, setSkills] = useState<LoadedSkill[]>([])
  const [sources, setSources] = useState<LoadedSource[]>([])

  // Available themes
  const themes = [
    { id: 'system', name: 'System', description: 'Follow system preference' },
    { id: 'light', name: 'Light', description: 'Light mode' },
    { id: 'dark', name: 'Dark', description: 'Dark mode' },
    { id: 'dracula', name: 'Dracula', description: 'Dark purple theme' },
    { id: 'nord', name: 'Nord', description: 'Arctic blue theme' },
  ]

  // Load billing info
  useEffect(() => {
    api.getBillingMethod()
      .then(info => {
        setBillingInfo(info)
        if (info.apiKey) {
          setApiKey(info.apiKey)
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingBilling(false))
  }, [api])

  // Load model setting
  useEffect(() => {
    api.getModel()
      .then(model => setSelectedModel(model || DEFAULT_MODEL))
      .catch(console.error)
      .finally(() => setIsLoadingModel(false))
  }, [api])

  // Load theme setting
  useEffect(() => {
    api.getColorTheme()
      .then(setSelectedTheme)
      .catch(console.error)
      .finally(() => setIsLoadingTheme(false))
  }, [api])

  // Load workspace settings
  useEffect(() => {
    if (workspaceId) {
      api.getWorkspaceSettings(workspaceId)
        .then(settings => {
          setWorkspaceSettings(settings)
          if (settings?.permissionMode) {
            setPermissionMode(settings.permissionMode)
          }
          if (settings?.thinkingLevel) {
            setThinkingLevel(settings.thinkingLevel)
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingWorkspace(false))
    } else {
      setIsLoadingWorkspace(false)
    }
  }, [api, workspaceId])

  // Load skills
  useEffect(() => {
    if (workspaceId) {
      api.getSkills(workspaceId)
        .then(setSkills)
        .catch(console.error)
        .finally(() => setIsLoadingSkills(false))
    } else {
      setIsLoadingSkills(false)
    }
  }, [api, workspaceId])

  // Load sources
  useEffect(() => {
    if (workspaceId) {
      api.getSources(workspaceId)
        .then(setSources)
        .catch(console.error)
        .finally(() => setIsLoadingSources(false))
    } else {
      setIsLoadingSources(false)
    }
  }, [api, workspaceId])

  // Test API connection
  const handleTestApiKey = useCallback(async () => {
    if (!apiKey) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await api.testApiConnection(apiKey)
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: 'Failed to test connection' })
    } finally {
      setIsTesting(false)
    }
  }, [api, apiKey])

  // Save API key
  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey) return

    setIsSavingApiKey(true)
    try {
      await api.updateBillingMethod('api_key', apiKey)
      setBillingInfo(prev => prev ? {
        ...prev,
        authType: 'api_key',
        hasCredential: true,
        apiKey,
      } : null)
    } catch (error) {
      console.error('Failed to save API key:', error)
    } finally {
      setIsSavingApiKey(false)
    }
  }, [api, apiKey])

  // Save model
  const handleModelChange = useCallback(async (modelId: string) => {
    setSelectedModel(modelId)
    setIsSavingModel(true)
    try {
      await api.setModel(modelId)
    } catch (error) {
      console.error('Failed to save model:', error)
    } finally {
      setIsSavingModel(false)
    }
  }, [api])

  // Save theme
  const handleThemeChange = useCallback(async (themeId: string) => {
    setSelectedTheme(themeId)
    setIsSavingTheme(true)
    try {
      await api.setColorTheme(themeId)
    } catch (error) {
      console.error('Failed to save theme:', error)
    } finally {
      setIsSavingTheme(false)
    }
  }, [api])

  // Save permission mode
  const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
    if (!workspaceId) return
    setPermissionMode(mode)
    setIsSavingWorkspace(true)
    try {
      await api.updateWorkspaceSetting(workspaceId, 'permissionMode', mode)
    } catch (error) {
      console.error('Failed to save permission mode:', error)
    } finally {
      setIsSavingWorkspace(false)
    }
  }, [api, workspaceId])

  // Save thinking level
  const handleThinkingLevelChange = useCallback(async (level: ThinkingLevel) => {
    if (!workspaceId) return
    setThinkingLevel(level)
    setIsSavingWorkspace(true)
    try {
      await api.updateWorkspaceSetting(workspaceId, 'thinkingLevel', level)
    } catch (error) {
      console.error('Failed to save thinking level:', error)
    } finally {
      setIsSavingWorkspace(false)
    }
  }, [api, workspaceId])

  const isLoading = isLoadingBilling || isLoadingModel || isLoadingTheme || isLoadingWorkspace

  if (isLoading) {
    return (
      <div className="flex-1 bg-foreground-1.5 flex items-center justify-center">
        <Spinner className="text-2xl text-foreground-30" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 bg-foreground-1.5 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 md:p-8 pb-safe space-y-6">
        {/* Page Title */}
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-accent" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Settings</h1>
        </div>

        {/* API Key Section */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">API Key</h2>
          </div>

          <p className="text-sm text-foreground-50 mb-4">
            Enter your Anthropic API key to use Claude. Your key is stored securely and never shared.
          </p>

          {/* API Key Input */}
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTestResult(null)
                }}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2.5 pr-10 bg-background border border-foreground/10 rounded-lg text-foreground placeholder:text-foreground-30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 font-mono text-sm"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-40 hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-success' : 'text-destructive'
              }`}>
                {testResult.success ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>API key is valid</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>{testResult.error || 'Invalid API key'}</span>
                  </>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestApiKey}
                disabled={!apiKey || isTesting}
                className="px-4 py-2 text-sm font-medium bg-foreground/5 text-foreground rounded-lg hover:bg-foreground/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="text-sm" />
                    Testing...
                  </span>
                ) : (
                  'Test Connection'
                )}
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey || isSavingApiKey}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isSavingApiKey ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="text-sm" />
                    Saving...
                  </span>
                ) : (
                  'Save API Key'
                )}
              </button>
            </div>

            {/* Current status */}
            {billingInfo?.hasCredential && (
              <div className="flex items-center gap-2 text-sm text-foreground-50">
                <Check className="w-4 h-4 text-success" />
                <span>API key configured</span>
              </div>
            )}
          </div>
        </section>

        {/* Model Selection Section */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Default Model</h2>
            {isSavingModel && <Spinner className="text-sm text-foreground-50" />}
          </div>

          <p className="text-sm text-foreground-50 mb-4">
            Choose the default Claude model for new conversations.
          </p>

          {/* Model options */}
          <div className="space-y-2">
            {MODELS.map((model) => {
              const isSelected = selectedModel === model.id
              return (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-foreground/10 hover:bg-foreground/5'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-foreground">{model.name}</div>
                    <div className="text-xs text-foreground-50">{model.description}</div>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-accent shrink-0" />}
                </button>
              )
            })}
          </div>
        </section>

        {/* Workspace Settings Section */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Workspace</h2>
            {isSavingWorkspace && <Spinner className="text-sm text-foreground-50" />}
          </div>

          <div className="space-y-6">
            {/* Permission Mode */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-foreground-50" />
                <h3 className="text-sm font-medium text-foreground">Default Permission Mode</h3>
              </div>
              <p className="text-xs text-foreground-50 mb-3">
                Controls how Claude asks for permission to use tools.
              </p>
              <div className="space-y-2">
                {(['safe', 'ask', 'allow-all'] as PermissionMode[]).map((mode) => {
                  const config = PERMISSION_MODE_CONFIG[mode]
                  const isSelected = permissionMode === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => handlePermissionModeChange(mode)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-foreground/10 hover:bg-foreground/5'
                      }`}
                    >
                      <svg
                        className={`w-5 h-5 ${config.colorClass.text}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={config.svgPath} />
                      </svg>
                      <div className="text-left flex-1">
                        <div className="font-medium text-foreground">{config.displayName}</div>
                        <div className="text-xs text-foreground-50">{config.description}</div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-accent shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Thinking Level */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-foreground-50" />
                <h3 className="text-sm font-medium text-foreground">Default Thinking Level</h3>
              </div>
              <p className="text-xs text-foreground-50 mb-3">
                Controls how much Claude thinks before responding.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {THINKING_LEVELS.map((level) => {
                  const isSelected = thinkingLevel === level.id
                  return (
                    <button
                      key={level.id}
                      onClick={() => handleThinkingLevelChange(level.id)}
                      className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-foreground/10 hover:bg-foreground/5'
                      }`}
                    >
                      <div className="font-medium text-foreground text-sm">{level.name}</div>
                      {isSelected && <Check className="w-4 h-4 text-accent mt-1" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Skills Section */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Skills</h2>
            {isLoadingSkills && <Spinner className="text-sm text-foreground-50" />}
          </div>

          <p className="text-sm text-foreground-50 mb-4">
            Skills are custom instructions that extend Claude's capabilities for specific tasks.
          </p>

          {isLoadingSkills ? (
            <div className="py-4 flex items-center justify-center">
              <Spinner className="text-xl text-foreground-30" />
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-lg bg-foreground/5">
              <Wand2 className="w-8 h-8 text-foreground-30 mx-auto mb-2" />
              <p className="text-foreground-50 text-sm mb-1">No skills configured</p>
              <p className="text-foreground-40 text-xs">
                Create SKILL.md files in your workspace to add custom agent skills
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map((skill) => (
                <div
                  key={skill.slug}
                  className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5 hover:bg-foreground/8 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    {skill.metadata.icon && /^\p{Emoji}/u.test(skill.metadata.icon) ? (
                      <span className="text-sm">{skill.metadata.icon}</span>
                    ) : (
                      <Wand2 className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">{skill.metadata.name}</div>
                    {skill.metadata.description && (
                      <p className="text-xs text-foreground-50 truncate">{skill.metadata.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-foreground-30 shrink-0" />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
            <p className="text-xs text-foreground-40">
              Skills are activated automatically based on file patterns or can be invoked by name.
              View the Skills section in the sidebar for more details.
            </p>
          </div>
        </section>

        {/* Sources Section */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plug className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Sources</h2>
            {isLoadingSources && <Spinner className="text-sm text-foreground-50" />}
          </div>

          <p className="text-sm text-foreground-50 mb-4">
            Sources connect Claude to external tools and services via MCP (Model Context Protocol).
          </p>

          {isLoadingSources ? (
            <div className="py-4 flex items-center justify-center">
              <Spinner className="text-xl text-foreground-30" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-lg bg-foreground/5">
              <Plug className="w-8 h-8 text-foreground-30 mx-auto mb-2" />
              <p className="text-foreground-50 text-sm mb-1">No sources configured</p>
              <p className="text-foreground-40 text-xs">
                Add MCP servers to extend Claude's capabilities with external tools
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => {
                const status = source.config.connectionStatus || 'untested'
                const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                  connected: { bg: 'bg-success/10', text: 'text-success', label: 'Connected' },
                  needs_auth: { bg: 'bg-warning/10', text: 'text-warning', label: 'Needs Auth' },
                  failed: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Failed' },
                  untested: { bg: 'bg-foreground/10', text: 'text-foreground-50', label: 'Not Tested' },
                  local_disabled: { bg: 'bg-foreground/10', text: 'text-foreground-50', label: 'Disabled' },
                }
                const statusInfo = statusColors[status] || statusColors.untested

                return (
                  <div
                    key={source.config.slug}
                    className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5 hover:bg-foreground/8 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      {source.config.icon && /^\p{Emoji}/u.test(source.config.icon) ? (
                        <span className="text-sm">{source.config.icon}</span>
                      ) : (
                        <Plug className="w-4 h-4 text-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{source.config.name}</div>
                      <p className="text-xs text-foreground-50">
                        {source.config.type === 'mcp' ? 'MCP Server' : 'API Source'}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
                      {statusInfo.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-foreground-30 shrink-0" />
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
            <p className="text-xs text-foreground-40">
              The web version supports remote MCP servers only. For local MCP servers (stdio),
              use the desktop app. View the Sources section in the sidebar for more details.
            </p>
          </div>
        </section>

        {/* Theme Section */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Theme</h2>
            {isSavingTheme && <Spinner className="text-sm text-foreground-50" />}
          </div>

          <p className="text-sm text-foreground-50 mb-4">
            Choose your preferred color theme.
          </p>

          {/* Theme options */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {themes.map((theme) => {
              const isSelected = selectedTheme === theme.id
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-foreground/10 hover:bg-foreground/5'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full mb-2 ${
                    theme.id === 'system' ? 'bg-gradient-to-r from-foreground-10 to-foreground-80' :
                    theme.id === 'light' ? 'bg-white border border-foreground/10' :
                    theme.id === 'dark' ? 'bg-gray-900' :
                    theme.id === 'dracula' ? 'bg-purple-900' :
                    'bg-blue-900'
                  }`} />
                  <div className="font-medium text-foreground text-sm">{theme.name}</div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-accent mt-1" />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Platform Info */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="font-semibold text-foreground">Platform</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-foreground-50">
              <span>Edition</span>
              <span className="text-foreground">Web</span>
            </div>
            <div className="flex justify-between text-foreground-50">
              <span>Agent Execution</span>
              <span className="text-foreground">Server-side</span>
            </div>
            <div className="flex justify-between text-foreground-50">
              <span>MCP Support</span>
              <span className="text-foreground">Remote only</span>
            </div>
          </div>

          <p className="text-xs text-foreground-40 mt-4">
            The web version runs agents on the server. For local tool execution and
            better performance, consider using the desktop app.
          </p>
        </section>
      </div>
    </div>
  )
}
