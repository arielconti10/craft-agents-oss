/**
 * Shared Session Viewer Page
 *
 * A public, read-only view of a shared chat session.
 * Accessible without authentication via /share/:shareId
 */

import React, { useState, useEffect } from 'react'
import type { Message } from '@craft-agent/core/types'
import { Spinner } from '@craft-agent/ui'
import { MessageSquare, User, Bot, AlertCircle, Terminal, Clock } from 'lucide-react'
import { cn } from '@craft-agent/ui'

interface SharedSessionData {
  id: string
  name: string
  workspaceName: string
  messages: Message[]
  sharedAt: number
  updatedAt: number
}

interface SharedSessionPageProps {
  shareId: string
}

export function SharedSessionPage({ shareId }: SharedSessionPageProps) {
  const [session, setSession] = useState<SharedSessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSharedSession() {
      setIsLoading(true)
      setError(null)

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
        const response = await fetch(`${apiUrl}/api/share/${shareId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('This shared session could not be found. It may have been deleted or the link is incorrect.')
          } else {
            setError(`Failed to load shared session: ${response.statusText}`)
          }
          return
        }

        const data = await response.json()
        setSession(data)
      } catch (err) {
        console.error('Error fetching shared session:', err)
        setError('Failed to load shared session. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSharedSession()
  }, [shareId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-foreground-1.5 flex items-center justify-center">
        <div className="text-center">
          <Spinner className="text-4xl text-accent mx-auto" />
          <p className="mt-4 text-foreground-50">Loading shared session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-foreground-1.5 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-foreground-2 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Session Not Available</h1>
          <p className="text-foreground-50">{error}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-foreground-1.5">
      {/* Header */}
      <header className="bg-foreground-2 border-b border-foreground/5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                {session.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-foreground-50">
                <span>{session.workspaceName}</span>
                <span>·</span>
                <Clock className="w-3.5 h-3.5" />
                <span>Shared {formatTimestamp(session.sharedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {session.messages.map((message, index) => (
            <MessageBubble key={message.id || index} message={message} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-foreground/5 text-center">
          <p className="text-sm text-foreground-40">
            This is a read-only view of a shared session.
          </p>
          {session.updatedAt > session.sharedAt && (
            <p className="text-xs text-foreground-30 mt-1">
              Last updated: {formatTimestamp(session.updatedAt)}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isError = message.role === 'error' || message.isError

  // Get content text
  let content = ''
  if (typeof message.content === 'string') {
    content = message.content
  } else if (Array.isArray(message.content)) {
    const contentArray = message.content as Array<{ type: string; text?: string }>
    const textBlock = contentArray.find((block) => block.type === 'text')
    if (textBlock && textBlock.text) {
      content = textBlock.text
    }
  }

  if (isTool) {
    return (
      <div className="bg-foreground-2 rounded-lg p-4 border border-foreground/5">
        <div className="flex items-center gap-2 text-sm text-foreground-50 mb-2">
          <Terminal className="w-4 h-4" />
          <span className="font-medium">{message.toolDisplayName || message.toolName}</span>
          {message.toolStatus && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              message.toolStatus === 'completed' ? 'bg-success/20 text-success' :
              message.toolStatus === 'error' ? 'bg-destructive/20 text-destructive' :
              'bg-foreground/10 text-foreground-50'
            )}>
              {message.toolStatus}
            </span>
          )}
        </div>
        {message.toolIntent && (
          <p className="text-sm text-foreground-70 mb-2">{message.toolIntent}</p>
        )}
        {message.toolResult && (
          <pre className="text-xs text-foreground-50 bg-foreground/5 rounded p-2 overflow-x-auto max-h-48">
            {typeof message.toolResult === 'string'
              ? message.toolResult.slice(0, 1000)
              : JSON.stringify(message.toolResult, null, 2).slice(0, 1000)}
            {(typeof message.toolResult === 'string' ? message.toolResult.length : JSON.stringify(message.toolResult).length) > 1000 && '...'}
          </pre>
        )}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Error</span>
        </div>
        <p className="text-destructive/90">{content}</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex gap-3',
      isUser && 'flex-row-reverse'
    )}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isUser ? 'bg-accent' : 'bg-foreground/10'
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-foreground" />
        )}
      </div>

      {/* Message */}
      <div className={cn(
        'flex-1 min-w-0 max-w-[80%]',
        isUser && 'text-right'
      )}>
        <div className={cn(
          'inline-block rounded-xl px-4 py-3 text-left',
          isUser
            ? 'bg-accent text-white'
            : 'bg-foreground-2 text-foreground'
        )}>
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
        {message.timestamp && (
          <p className="text-xs text-foreground-30 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
