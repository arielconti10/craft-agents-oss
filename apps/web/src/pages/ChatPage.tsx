/**
 * Chat Page
 *
 * Displays a chat session with message history and input.
 * Styled to match the Electron app's design.
 */

import React, { useState, useRef, useEffect } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import type { Session, SessionEvent } from '@craft-agent/shared/platform'
import { Spinner, Markdown } from '@craft-agent/ui'

interface ChatPageProps {
  session: Session
  onSessionUpdate?: (session: Session) => void
}

export function ChatPage({ session, onSessionUpdate }: ChatPageProps) {
  const api = usePlatformAPI()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(session.isProcessing)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset state when session changes
  useEffect(() => {
    setIsProcessing(session.isProcessing || false)
    setStreamingText('')
  }, [session.id, session.isProcessing])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.messages, streamingText])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Subscribe to session events for streaming
  useEffect(() => {
    const cleanup = api.onSessionEvent((event: SessionEvent) => {
      if (event.sessionId !== session.id) return

      switch (event.type) {
        case 'text_delta':
          setStreamingText(prev => prev + event.delta)
          break

        case 'text_complete':
          setStreamingText('')
          break

        case 'complete':
          setIsProcessing(false)
          setStreamingText('')
          // Refresh session to get updated messages
          api.getSessionMessages(session.id).then(updated => {
            if (updated && onSessionUpdate) {
              onSessionUpdate(updated)
            }
          })
          break

        case 'error':
          setIsProcessing(false)
          setStreamingText('')
          console.error('Session error:', event.error)
          break

        case 'interrupted':
          setIsProcessing(false)
          setStreamingText('')
          break
      }
    })

    return cleanup
  }, [api, session.id, onSessionUpdate])

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    const message = input.trim()
    setInput('')
    setIsProcessing(true)
    setStreamingText('')

    try {
      await api.sendMessage(session.id, message)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsProcessing(false)
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

  return (
    <div className="flex flex-col h-full bg-foreground-1.5">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-foreground/5 bg-background/50">
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

      {/* Messages area with gradient fade */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 32px, black calc(100% - 32px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 32px, black calc(100% - 32px), transparent 100%)'
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {session.messages.length === 0 && !streamingText ? (
            <div className="text-center text-foreground-40 py-16">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">Type a message below to begin chatting with Claude.</p>
            </div>
          ) : (
            <>
              {session.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {/* Streaming response */}
              {streamingText && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-accent text-sm font-medium">C</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground-50 mb-1">Claude</div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                      <Markdown content={streamingText} />
                      <span className="inline-block w-2 h-4 bg-accent/50 animate-pulse ml-1" />
                    </div>
                  </div>
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && !streamingText && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-accent text-sm font-medium">C</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground-50">
                    <Spinner className="text-base" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4 bg-background/50 border-t border-foreground/5">
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
    </div>
  )
}

/**
 * Message bubble component with proper styling
 */
function MessageBubble({ message }: { message: { id: string; role: string; content: string } }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md bg-accent text-white shadow-minimal">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        <span className="text-accent text-sm font-medium">C</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-foreground-50 mb-1">Claude</div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          <Markdown content={message.content} />
        </div>
      </div>
    </div>
  )
}
