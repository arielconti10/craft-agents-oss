/**
 * Chat Page
 *
 * Displays a chat session with message history and input.
 */

import React, { useState, useRef, useEffect } from 'react'
import { usePlatformAPI } from '../contexts/PlatformContext'
import type { Session, SessionEvent } from '@craft-agent/shared/platform'

interface ChatPageProps {
  session: Session
}

export function ChatPage({ session }: ChatPageProps) {
  const api = usePlatformAPI()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(session.isProcessing)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.messages, streamingText])

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
  }, [api, session.id])

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="font-semibold">{session.name || 'New Chat'}</h2>
        <p className="text-sm text-[var(--color-muted)]">
          {session.messages.length} messages
          {session.permissionMode && ` | Mode: ${session.permissionMode}`}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages.length === 0 && !streamingText ? (
          <div className="text-center text-[var(--color-muted)] py-8">
            <p>Start a conversation by typing a message below.</p>
          </div>
        ) : (
          <>
            {session.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming response */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-2 rounded-lg bg-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-muted)] mb-1">Assistant</div>
                  <div className="whitespace-pre-wrap">{streamingText}</div>
                  <div className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && !streamingText && (
              <div className="flex justify-start">
                <div className="px-4 py-2 rounded-lg bg-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    <span className="text-[var(--color-muted)]">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={1}
            disabled={isProcessing}
          />
          {isProcessing ? (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-[var(--color-destructive)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Message bubble component
 */
function MessageBubble({ message }: { message: { id: string; role: string; content: string } }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-border)]'
        }`}
      >
        <div className="text-xs opacity-70 mb-1">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
}
