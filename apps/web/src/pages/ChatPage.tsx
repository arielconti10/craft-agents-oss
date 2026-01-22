/**
 * Chat Page
 *
 * Displays a chat session using shared UI components from @craft-agent/ui.
 * Uses SessionViewer for proper turn-based display with tool activities.
 * Supports inline overlays for code, terminal, and diff previews.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import type { Session, SessionEvent } from '@craft-agent/shared/platform'
import type { StoredSession, StoredMessage, Message } from '@craft-agent/core'
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

export function ChatPage({ session, onSessionUpdate }: ChatPageProps) {
  const api = usePlatformAPI()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(session.isProcessing)
  const [streamingMessages, setStreamingMessages] = useState<Message[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Overlay state for inline previews
  const [overlay, setOverlay] = useState<OverlayState>({ type: null })

  // Reset state when session changes
  useEffect(() => {
    setIsProcessing(session.isProcessing || false)
    setStreamingMessages([])
    setOverlay({ type: null })
  }, [session.id, session.isProcessing])

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

        case 'complete':
          setIsProcessing(false)
          setStreamingMessages([])
          api.getSessionMessages(session.id).then(updated => {
            if (updated && onSessionUpdate) {
              onSessionUpdate(updated)
            }
          })
          break

        case 'error':
          setIsProcessing(false)
          setStreamingMessages([])
          console.error('Session error:', event.error)
          break

        case 'interrupted':
          setIsProcessing(false)
          setStreamingMessages([])
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
      await api.sendMessage(session.id, message)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsProcessing(false)
      setStreamingMessages([])
    }
  }, [api, input, isProcessing, session.id])

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

  // Header component
  const header = (
    <div className="px-6 py-4 bg-background/50">
      <h2 className="font-semibold text-foreground">{session.name || 'New Chat'}</h2>
      <p className="text-sm text-foreground-50">
        {session.messages.length} messages
        {session.permissionMode && (
          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-foreground/5">
            {session.permissionMode}
          </span>
        )}
      </p>
    </div>
  )

  // Footer component (input area)
  const footer = (
    <div className="p-4 bg-background/50">
      <div className={`${CHAT_LAYOUT.maxWidth} mx-auto`}>
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Claude..."
              className="w-full px-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground placeholder:text-foreground-30 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
              rows={1}
              disabled={isProcessing}
            />
          </div>
          {isProcessing ? (
            <button
              onClick={handleCancel}
              className="px-5 py-3 bg-destructive text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-minimal"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-5 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-minimal"
            >
              Send
            </button>
          )}
        </div>
        <p className="text-xs text-foreground-30 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )

  // Show empty state for new sessions
  if (session.messages.length === 0 && streamingMessages.length === 0) {
    return (
      <div className="flex flex-col h-full bg-foreground-1.5">
        {header}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-foreground-40 py-16">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Type a message below to begin chatting with Claude.</p>
          </div>
        </div>
        {footer}
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
      </div>
    </PlatformProvider>
  )
}
