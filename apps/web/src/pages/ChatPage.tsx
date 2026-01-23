/**
 * Chat Page
 *
 * Displays a chat session using shared UI components from @craft-agent/ui.
 * Uses SessionViewer for proper turn-based display with tool activities.
 * Supports inline overlays for code, terminal, and diff previews.
 *
 * Features:
 * - Mode selector (Explore/Ask/Execute)
 * - Model selector (Opus/Sonnet/Haiku)
 * - File attachments
 * - Rich markdown rendering with syntax highlighting
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import type { Session, SessionEvent, FileAttachment, PermissionMode, PermissionRequest, CredentialRequest, CredentialResponse } from '@craft-agent/shared/platform'
import type { StoredSession, StoredMessage, Message } from '@craft-agent/core'
import { MODELS, getModelShortName, DEFAULT_MODEL } from '@craft-agent/shared/config/models'
import { PERMISSION_MODE_CONFIG } from '@craft-agent/shared/agent/mode-types'
import {
  SessionViewer,
  Spinner,
  PlatformProvider,
  CodePreviewOverlay,
  TerminalPreviewOverlay,
  DiffPreviewOverlay,
  DocumentFormattedMarkdownOverlay,
  CHAT_LAYOUT,
  type PlatformActions,
  type ActivityItem,
} from '@craft-agent/ui'
import {
  ChevronDown,
  Paperclip,
  X,
  Send,
  Square,
  Check,
  FileText,
  Image as ImageIcon,
  File,
} from 'lucide-react'
import { useEscapeInterrupt, EscapeInterruptOverlay } from '../hooks/useEscapeInterrupt'
import { PermissionRequestCard } from '../components/chat/PermissionRequestCard'
import { CredentialRequestCard } from '../components/chat/CredentialRequestCard'

interface ChatPageProps {
  session: Session
  onSessionUpdate?: (session: Session) => void
}

/**
 * Convert Message to StoredMessage format for SessionViewer
 * Maps `role` → `type` as expected by StoredMessage
 */
function messageToStoredMessage(msg: Message): StoredMessage {
  return {
    id: msg.id,
    type: msg.role, // Key difference: StoredMessage uses `type`, Message uses `role`
    content: msg.content,
    timestamp: msg.timestamp,
    toolName: msg.toolName,
    toolUseId: msg.toolUseId,
    toolInput: msg.toolInput,
    toolResult: msg.toolResult,
    toolStatus: msg.toolStatus,
    toolDuration: msg.toolDuration,
    toolIntent: msg.toolIntent,
    toolDisplayName: msg.toolDisplayName,
    parentToolUseId: msg.parentToolUseId,
    taskId: msg.taskId,
    shellId: msg.shellId,
    elapsedSeconds: msg.elapsedSeconds,
    isBackground: msg.isBackground,
    attachments: msg.attachments,
    isError: msg.isError,
    isIntermediate: msg.isIntermediate,
    turnId: msg.turnId,
    errorCode: msg.errorCode,
    errorTitle: msg.errorTitle,
    errorDetails: msg.errorDetails,
    errorOriginal: msg.errorOriginal,
    errorCanRetry: msg.errorCanRetry,
    ultrathink: msg.ultrathink,
    planPath: msg.planPath,
    authRequestId: msg.authRequestId,
    authRequestType: msg.authRequestType,
    authSourceSlug: msg.authSourceSlug,
    authSourceName: msg.authSourceName,
    authStatus: msg.authStatus,
    authCredentialMode: msg.authCredentialMode,
    authHeaderName: msg.authHeaderName,
    authLabels: msg.authLabels,
    authDescription: msg.authDescription,
    authHint: msg.authHint,
    authError: msg.authError,
    authEmail: msg.authEmail,
    authWorkspace: msg.authWorkspace,
  }
}

/**
 * Convert Session to StoredSession format for SessionViewer
 */
function sessionToStoredSession(session: Session): StoredSession {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    name: session.name,
    createdAt: session.lastMessageAt,
    lastUsedAt: session.lastMessageAt,
    isFlagged: session.isFlagged,
    status: session.todoState as 'todo' | 'in_progress' | 'needs_review' | 'done' | 'cancelled' | undefined,
    lastReadMessageId: session.lastReadMessageId,
    messages: session.messages.map(messageToStoredMessage),
    tokenUsage: session.tokenUsage ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      costUsd: 0,
    },
  }
}

// Overlay state types
type OverlayType = 'code' | 'terminal' | 'markdown' | null

interface OverlayState {
  type: OverlayType
  // For code overlay
  content?: string
  filePath?: string
  // For terminal overlay
  command?: string
  output?: string
}

/**
 * Permission Mode Icon component
 */
function PermissionModeIcon({ mode, className }: { mode: PermissionMode; className?: string }) {
  const config = PERMISSION_MODE_CONFIG[mode]
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={config.svgPath} />
    </svg>
  )
}

/**
 * File attachment icon based on type
 */
function AttachmentIcon({ type, className }: { type: FileAttachment['type']; className?: string }) {
  switch (type) {
    case 'image':
      return <ImageIcon className={className} />
    case 'text':
      return <FileText className={className} />
    default:
      return <File className={className} />
  }
}

export function ChatPage({ session, onSessionUpdate }: ChatPageProps) {
  const api = usePlatformAPI()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(session.isProcessing)
  const [streamingMessages, setStreamingMessages] = useState<Message[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Overlay state for inline previews
  const [overlay, setOverlay] = useState<OverlayState>({ type: null })

  // Dropdown states
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  // Local state for permission mode and model (with optimistic updates)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(session.permissionMode || 'ask')
  const [currentModel, setCurrentModel] = useState(session.model || DEFAULT_MODEL)

  // File attachments
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  // Permission request state
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null)
  const [isRespondingToPermission, setIsRespondingToPermission] = useState(false)

  // Credential request state
  const [pendingCredential, setPendingCredential] = useState<CredentialRequest | null>(null)
  const [isRespondingToCredential, setIsRespondingToCredential] = useState(false)

  // Double-Esc interrupt handler
  const { isWaitingForSecondEsc } = useEscapeInterrupt({
    enabled: isProcessing,
    onInterrupt: () => {
      api.cancelProcessing(session.id).catch(console.error)
    },
  })

  // Reset state when session changes
  useEffect(() => {
    setIsProcessing(session.isProcessing || false)
    setStreamingMessages([])
    setOverlay({ type: null })
    setPermissionMode(session.permissionMode || 'ask')
    setCurrentModel(session.model || DEFAULT_MODEL)
    setAttachments([])
    setPendingPermission(null)
    setIsRespondingToPermission(false)
    setPendingCredential(null)
    setIsRespondingToCredential(false)
  }, [session.id, session.isProcessing, session.permissionMode, session.model])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Subscribe to session events for streaming
  useEffect(() => {
    let currentTurnId: string | undefined
    let streamingText = ''

    const cleanup = api.onSessionEvent((event: SessionEvent) => {
      if (event.sessionId !== session.id) return

      switch (event.type) {
        case 'text_delta':
          streamingText += event.delta
          currentTurnId = event.turnId
          setStreamingMessages(prev => {
            const existing = prev.find(m => m.turnId === currentTurnId && m.role === 'assistant')
            if (existing) {
              return prev.map(m =>
                m.id === existing.id ? { ...m, content: streamingText } : m
              )
            }
            return [...prev, {
              id: `streaming-${currentTurnId || Date.now()}`,
              role: 'assistant' as const,
              content: streamingText,
              timestamp: Date.now(),
              turnId: currentTurnId,
              isStreaming: true,
            }]
          })
          break

        case 'text_complete':
          streamingText = ''
          currentTurnId = event.turnId
          break

        case 'tool_start':
          currentTurnId = event.turnId
          setStreamingMessages(prev => [...prev, {
            id: event.toolUseId,
            role: 'tool' as const,
            content: '',
            timestamp: Date.now(),
            toolName: event.toolName,
            toolUseId: event.toolUseId,
            toolInput: event.toolInput,
            toolStatus: 'executing',
            toolIntent: event.toolIntent,
            toolDisplayName: event.toolDisplayName,
            turnId: event.turnId,
            parentToolUseId: event.parentToolUseId,
          }])
          break

        case 'tool_result':
          setStreamingMessages(prev => prev.map(m =>
            m.toolUseId === event.toolUseId
              ? {
                  ...m,
                  toolResult: event.result,
                  toolStatus: event.isError ? 'error' : 'completed',
                  isError: event.isError,
                }
              : m
          ))
          break

        case 'permission_mode_changed':
          setPermissionMode(event.permissionMode)
          break

        case 'permission_request':
          // Show permission request UI
          setPendingPermission(event.request)
          break

        case 'credential_request':
          // Show credential request UI
          setPendingCredential(event.request)
          break

        case 'session_model_changed':
          if (event.model) setCurrentModel(event.model)
          break

        case 'title_generated':
          // Update session title in parent
          if (onSessionUpdate && event.title) {
            onSessionUpdate({ ...session, name: event.title })
          }
          break

        case 'session_flagged':
          // Update session flag status in parent
          if (onSessionUpdate) {
            onSessionUpdate({ ...session, isFlagged: true })
          }
          break

        case 'session_unflagged':
          // Update session flag status in parent
          if (onSessionUpdate) {
            onSessionUpdate({ ...session, isFlagged: false })
          }
          break

        case 'todo_state_changed':
          // Update session todo state in parent
          if (onSessionUpdate && event.todoState) {
            onSessionUpdate({ ...session, todoState: event.todoState })
          }
          break

        case 'usage_update':
          // Update token usage in parent (merge with defaults for required fields)
          if (onSessionUpdate && event.tokenUsage) {
            const baseUsage = session.tokenUsage ?? {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              contextTokens: 0,
              costUsd: 0,
            }
            onSessionUpdate({
              ...session,
              tokenUsage: {
                ...baseUsage,
                inputTokens: event.tokenUsage.inputTokens ?? baseUsage.inputTokens,
                contextWindow: event.tokenUsage.contextWindow,
              }
            })
          }
          break

        case 'status':
        case 'info':
          // Log status/info messages (could add a toast notification in the future)
          console.log(`[${event.type}]`, event.message)
          break

        case 'complete':
          setIsProcessing(false)
          setStreamingMessages([])
          setAttachments([])
          setPendingPermission(null)
          setPendingCredential(null)
          api.getSessionMessages(session.id).then(updated => {
            if (updated && onSessionUpdate) {
              onSessionUpdate(updated)
            }
          })
          break

        case 'error':
          setIsProcessing(false)
          setStreamingMessages([])
          setPendingPermission(null)
          setPendingCredential(null)
          console.error('Session error:', event.error)
          break

        case 'interrupted':
          setIsProcessing(false)
          setStreamingMessages([])
          setPendingPermission(null)
          setPendingCredential(null)
          break
      }
    })

    return cleanup
  }, [api, session.id, onSessionUpdate])

  // Convert session to StoredSession format with streaming messages
  const storedSession = useMemo(() => {
    const base = sessionToStoredSession(session)
    if (streamingMessages.length > 0) {
      return {
        ...base,
        messages: [...base.messages, ...streamingMessages.map(messageToStoredMessage)],
      }
    }
    return base
  }, [session, streamingMessages])

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const message = input.trim()
    setInput('')
    setIsProcessing(true)
    setStreamingMessages([])

    const optimisticMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
      isPending: true,
    }
    setStreamingMessages([optimisticMessage])

    try {
      await api.sendMessage(session.id, message, attachments.length > 0 ? attachments : undefined)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsProcessing(false)
      setStreamingMessages([])
    }
  }, [api, input, isProcessing, session.id, attachments])

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Cancel processing
  const handleCancel = useCallback(async () => {
    try {
      await api.cancelProcessing(session.id)
    } catch (error) {
      console.error('Failed to cancel:', error)
    }
  }, [api, session.id])

  // Close overlay
  const handleCloseOverlay = useCallback(() => {
    setOverlay({ type: null })
  }, [])

  // Handle permission response
  const handlePermissionResponse = useCallback(async (allowed: boolean, alwaysAllow: boolean) => {
    if (!pendingPermission) return

    setIsRespondingToPermission(true)
    try {
      await api.respondToPermission(
        session.id,
        pendingPermission.requestId,
        allowed,
        alwaysAllow
      )
      setPendingPermission(null)
    } catch (error) {
      console.error('Failed to respond to permission:', error)
    } finally {
      setIsRespondingToPermission(false)
    }
  }, [api, session.id, pendingPermission])

  const handlePermissionAllow = useCallback(() => {
    handlePermissionResponse(true, false)
  }, [handlePermissionResponse])

  const handlePermissionAlwaysAllow = useCallback(() => {
    handlePermissionResponse(true, true)
  }, [handlePermissionResponse])

  const handlePermissionDeny = useCallback(() => {
    handlePermissionResponse(false, false)
  }, [handlePermissionResponse])

  // Handle credential response
  const handleCredentialSubmit = useCallback(async (response: CredentialResponse) => {
    if (!pendingCredential) return

    setIsRespondingToCredential(true)
    try {
      await api.respondToCredential(
        session.id,
        pendingCredential.requestId,
        response
      )
      setPendingCredential(null)
    } catch (error) {
      console.error('Failed to respond to credential:', error)
    } finally {
      setIsRespondingToCredential(false)
    }
  }, [api, session.id, pendingCredential])

  const handleCredentialCancel = useCallback(() => {
    if (!pendingCredential) return

    // Send cancelled response
    handleCredentialSubmit({
      type: 'credential',
      cancelled: true,
    })
  }, [pendingCredential, handleCredentialSubmit])

  // Handle permission mode change
  const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
    setPermissionMode(mode)
    setModeDropdownOpen(false)
    try {
      await api.sessionCommand(session.id, { type: 'setPermissionMode', mode })
    } catch (error) {
      console.error('Failed to change permission mode:', error)
      setPermissionMode(session.permissionMode || 'ask') // Revert on error
    }
  }, [api, session.id, session.permissionMode])

  // Handle model change (via workspace settings for now)
  const handleModelChange = useCallback(async (modelId: string) => {
    setCurrentModel(modelId)
    setModelDropdownOpen(false)
    // Note: Model is set at workspace level, not session level in current API
    // This would need to be updated when session-level model setting is available
  }, [])

  // Handle file attachment
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || ''
        const isImage = file.type.startsWith('image/')
        const isText = file.type.startsWith('text/') ||
          ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css'].some(ext => file.name.endsWith(ext))

        const attachment: FileAttachment = {
          type: isImage ? 'image' : isText ? 'text' : 'unknown',
          path: file.name,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: isImage ? base64 : undefined,
          text: isText && base64 ? atob(base64) : undefined,
          size: file.size,
        }
        setAttachments(prev => [...prev, attachment])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    e.target.value = ''
  }, [])

  // Remove attachment
  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Platform actions for web with overlay support
  const platformActions: PlatformActions = useMemo(() => ({
    onOpenUrl: (url: string) => window.open(url, '_blank'),
    onCopyToClipboard: (text: string) => navigator.clipboard.writeText(text),

    // Open code preview in overlay
    onOpenCodePreview: (sessionId: string, toolUseId: string) => {
      // Find the tool result in session messages
      const msg = session.messages.find(m => m.toolUseId === toolUseId)
      if (msg?.toolResult) {
        const input = msg.toolInput as { file_path?: string } | undefined
        setOverlay({
          type: 'code',
          content: String(msg.toolResult),
          filePath: input?.file_path,
        })
      }
    },

    // Open terminal preview in overlay
    onOpenTerminalPreview: (sessionId: string, toolUseId: string) => {
      const msg = session.messages.find(m => m.toolUseId === toolUseId)
      if (msg?.toolResult) {
        const input = msg.toolInput as { command?: string } | undefined
        setOverlay({
          type: 'terminal',
          command: input?.command || msg.toolName || 'command',
          output: String(msg.toolResult),
        })
      }
    },

    // Open markdown preview in overlay
    onOpenMarkdownPreview: (content: string) => {
      setOverlay({
        type: 'markdown',
        content,
      })
    },

    // Activity click handler - show appropriate overlay based on tool type
    onOpenActivityDetails: (sessionId: string, activityId: string) => {
      const msg = session.messages.find(m => m.toolUseId === activityId)
      if (!msg?.toolResult) return

      const toolName = msg.toolName?.toLowerCase() || ''
      const input = msg.toolInput as { file_path?: string; command?: string } | undefined

      if (toolName === 'read' || toolName === 'write' || toolName === 'edit') {
        setOverlay({
          type: 'code',
          content: String(msg.toolResult),
          filePath: input?.file_path,
        })
      } else if (toolName === 'bash' || toolName === 'grep' || toolName === 'glob') {
        setOverlay({
          type: 'terminal',
          command: input?.command || toolName,
          output: String(msg.toolResult),
        })
      }
    },
  }), [session.messages])

  // Handle activity click
  const handleActivityClick = useCallback((activity: ActivityItem) => {
    if (!activity.content) return

    const toolName = activity.toolName?.toLowerCase() || ''
    const toolInput = activity.toolInput as { file_path?: string; command?: string } | undefined

    if (toolName === 'read' || toolName === 'write' || toolName === 'edit') {
      setOverlay({
        type: 'code',
        content: String(activity.content),
        filePath: toolInput?.file_path,
      })
    } else if (toolName === 'bash' || toolName === 'grep' || toolName === 'glob') {
      setOverlay({
        type: 'terminal',
        command: toolInput?.command || toolName,
        output: String(activity.content),
      })
    }
  }, [])

  // Get current mode config
  const modeConfig = PERMISSION_MODE_CONFIG[permissionMode]

  // Header component
  const header = (
    <div className="px-4 md:px-6 py-3 md:py-4 bg-background/50 border-b border-foreground/5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground truncate">{session.name || 'New Chat'}</h2>
          <p className="text-xs text-foreground-50 mt-0.5">
            {session.messages.length} messages
          </p>
        </div>

        {/* Mode badge */}
        <div className="relative ml-3">
          <button
            onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
            className={`h-7 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${modeConfig.colorClass.text} bg-current/10 hover:bg-current/15`}
          >
            <PermissionModeIcon mode={permissionMode} className="w-3.5 h-3.5" />
            <span>{modeConfig.shortName}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {modeDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModeDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-background rounded-lg shadow-strong border border-foreground/5 py-1">
                {(['safe', 'ask', 'allow-all'] as PermissionMode[]).map(mode => {
                  const config = PERMISSION_MODE_CONFIG[mode]
                  const isSelected = mode === permissionMode
                  return (
                    <button
                      key={mode}
                      onClick={() => handlePermissionModeChange(mode)}
                      className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-foreground/5 ${
                        isSelected ? 'bg-foreground/5' : ''
                      }`}
                    >
                      <PermissionModeIcon mode={mode} className={`w-4 h-4 ${config.colorClass.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{config.displayName}</div>
                        <div className="text-xs text-foreground-50">{config.description}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  // Footer component (input area)
  const footer = (
    <div className="bg-background/50 border-t border-foreground/5">
      {/* Permission request card */}
      {pendingPermission && (
        <div className="px-4 md:px-6 py-3 border-b border-foreground/5">
          <div className={`${CHAT_LAYOUT.maxWidth} mx-auto`}>
            <PermissionRequestCard
              request={pendingPermission}
              onAllow={handlePermissionAllow}
              onAlwaysAllow={handlePermissionAlwaysAllow}
              onDeny={handlePermissionDeny}
              isResponding={isRespondingToPermission}
            />
          </div>
        </div>
      )}

      {/* Credential request card */}
      {pendingCredential && (
        <div className="px-4 md:px-6 py-3 border-b border-foreground/5">
          <div className={`${CHAT_LAYOUT.maxWidth} mx-auto`}>
            <CredentialRequestCard
              request={pendingCredential}
              onSubmit={handleCredentialSubmit}
              onCancel={handleCredentialCancel}
              isSubmitting={isRespondingToCredential}
            />
          </div>
        </div>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="px-4 md:px-6 py-2 border-b border-foreground/5 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${index}`}
              className="flex items-center gap-2 px-2 py-1.5 bg-foreground/5 rounded-lg text-xs"
            >
              <AttachmentIcon type={attachment.type} className="w-3.5 h-3.5 text-foreground-50" />
              <span className="text-foreground truncate max-w-[120px]">{attachment.name}</span>
              <button
                onClick={() => handleRemoveAttachment(index)}
                className="text-foreground-40 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 md:p-4">
        <div className={`${CHAT_LAYOUT.maxWidth} mx-auto`}>
          {/* Input container */}
          <div className="bg-foreground/5 rounded-xl border border-foreground/10 focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/50 transition-all">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Craft Agents..."
              className="w-full px-4 py-3 bg-transparent text-foreground placeholder:text-foreground-30 resize-none focus:outline-none"
              rows={1}
              disabled={isProcessing}
            />

            {/* Bottom bar with buttons */}
            <div className="flex items-center justify-between px-3 pb-2">
              {/* Left side - attachment and model */}
              <div className="flex items-center gap-1">
                {/* Attach file button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.txt,.md,.json,.js,.ts,.py,.html,.css,.pdf"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-2 rounded-lg text-foreground-40 hover:text-foreground hover:bg-foreground/5 disabled:opacity-50 transition-colors"
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Model selector */}
                <div className="relative">
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    disabled={isProcessing}
                    className="h-7 px-2 rounded-lg text-xs font-medium text-foreground-50 hover:text-foreground hover:bg-foreground/5 disabled:opacity-50 flex items-center gap-1 transition-colors"
                  >
                    {getModelShortName(currentModel)}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>

                  {modelDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                      <div className="absolute left-0 bottom-full mb-1 z-50 w-56 bg-background rounded-lg shadow-strong border border-foreground/5 py-1">
                        {MODELS.map(model => {
                          const isSelected = model.id === currentModel
                          return (
                            <button
                              key={model.id}
                              onClick={() => handleModelChange(model.id)}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-foreground/5 ${
                                isSelected ? 'bg-foreground/5' : ''
                              }`}
                            >
                              <div>
                                <div className="text-sm font-medium text-foreground">{model.name}</div>
                                <div className="text-xs text-foreground-50">{model.description}</div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right side - send/stop button */}
              {isProcessing ? (
                <button
                  onClick={handleCancel}
                  className="p-2 bg-destructive text-white rounded-lg hover:opacity-90 transition-opacity"
                  title="Stop"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-foreground-30 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )

  // Show empty state for new sessions
  if (session.messages.length === 0 && streamingMessages.length === 0) {
    return (
      <div className="flex flex-col h-full bg-foreground-1.5 relative">
        {header}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-foreground-40 py-16 px-4">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Type a message below to begin chatting with Claude.</p>
          </div>
        </div>
        {footer}
        <EscapeInterruptOverlay isVisible={isWaitingForSecondEsc} />
      </div>
    )
  }

  return (
    <PlatformProvider actions={platformActions}>
      <div className="flex flex-col h-full bg-foreground-1.5 relative">
        <SessionViewer
          session={storedSession}
          mode="interactive"
          platformActions={platformActions}
          className="flex-1"
          header={header}
          footer={footer}
          sessionFolderPath={session.sessionFolderPath}
          onActivityClick={handleActivityClick}
        />

        {/* Code preview overlay */}
        {overlay.type === 'code' && overlay.content && (
          <CodePreviewOverlay
            isOpen={true}
            content={overlay.content}
            filePath={overlay.filePath || 'output'}
            onClose={handleCloseOverlay}
          />
        )}

        {/* Terminal preview overlay */}
        {overlay.type === 'terminal' && overlay.output && (
          <TerminalPreviewOverlay
            isOpen={true}
            command={overlay.command || ''}
            output={overlay.output}
            onClose={handleCloseOverlay}
          />
        )}

        {/* Markdown preview overlay */}
        {overlay.type === 'markdown' && overlay.content && (
          <DocumentFormattedMarkdownOverlay
            isOpen={true}
            content={overlay.content}
            onClose={handleCloseOverlay}
          />
        )}

        {/* Escape interrupt indicator */}
        <EscapeInterruptOverlay isVisible={isWaitingForSecondEsc} />
      </div>
    </PlatformProvider>
  )
}
