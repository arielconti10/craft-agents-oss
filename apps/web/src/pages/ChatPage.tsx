/**
 * Chat Page
 *
 * Displays a chat session using shared UI components from @craft-agent/ui.
 * Uses SessionViewer for proper turn-based display with tool activities.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import type { Session, SessionEvent } from '@craft-agent/shared/platform'
import type { StoredSession, StoredMessage, Message } from '@craft-agent/core'
import {
  SessionViewer,
  Spinner,
  PlatformProvider,
  type PlatformActions,
} from '@craft-agent/ui'

interface ChatPageProps {
  session: Session
  onSessionUpdate?: (session: Session) => void
}

/**
 * Convert Message to StoredMessage format for SessionViewer
 */
function messageToStoredMessage(msg: Message): StoredMessage {
  return {
    id: msg.id,
    type: msg.role,
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

export function ChatPage({ session, onSessionUpdate }: ChatPageProps) {
  const api = usePlatformAPI()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(session.isProcessing)
  const [streamingMessages, setStreamingMessages] = useState<Message[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset state when session changes
  useEffect(() => {
    setIsProcessing(session.isProcessing || false)
    setStreamingMessages([])
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
            // Update or create streaming message
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
          // Refresh session to get updated messages
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
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    const message = input.trim()
    setInput('')
    setIsProcessing(true)
    setStreamingMessages([])

    // Add optimistic user message
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
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Cancel processing
  const handleCancel = async () => {
    try {
      await api.cancelProcessing(session.id)
    } catch (error) {
      console.error('Failed to cancel:', error)
    }
  }

  // Platform actions for web
  const platformActions: PlatformActions = useMemo(() => ({
    onOpenUrl: (url: string) => window.open(url, '_blank'),
    onCopyToClipboard: (text: string) => navigator.clipboard.writeText(text),
    // File opening not available on web - could show inline preview
    onOpenFile: undefined,
    // Could implement inline modals for these
    onOpenCodePreview: undefined,
    onOpenTerminalPreview: undefined,
    onOpenMarkdownPreview: undefined,
  }), [])

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
      <div className="max-w-3xl mx-auto">
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
      <div className="flex flex-col h-full bg-foreground-1.5">
        <SessionViewer
          session={storedSession}
          mode="interactive"
          platformActions={platformActions}
          className="flex-1"
          header={header}
          footer={footer}
          sessionFolderPath={session.sessionFolderPath}
        />
      </div>
    </PlatformProvider>
  )
}
