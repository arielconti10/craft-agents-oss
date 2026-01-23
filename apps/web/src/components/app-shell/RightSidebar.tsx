/**
 * RightSidebar - Session metadata panel
 *
 * Displays and allows editing of:
 * - Session name
 * - Session info (messages, last activity)
 * - Token usage
 *
 * Mobile: Uses a bottom sheet
 * Desktop: Shows as a right panel
 */

import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Flag, FlagOff } from 'lucide-react'
import { cn } from '@craft-agent/ui'
import type { Session } from '@craft-agent/shared/platform'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet'

// ============================================================================
// TYPES
// ============================================================================

interface RightSidebarProps {
  session: Session | null
  isOpen: boolean
  onClose: () => void
  onRenameSession: (name: string) => void
  onToggleFlag: () => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RightSidebar({
  session,
  isOpen,
  onClose,
  onRenameSession,
  onToggleFlag,
}: RightSidebarProps) {
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!session) return null

  // Mobile: Use bottom sheet
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="px-4 py-3 border-b border-foreground/5">
            <SheetTitle>Session Details</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-8">
            <SessionMetadataContent
              session={session}
              onRenameSession={onRenameSession}
              onToggleFlag={onToggleFlag}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Right panel
  if (!isOpen) return null

  return (
    <div className="w-72 flex-col bg-foreground-2 border-l border-foreground/5 shrink-0 hidden md:flex">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-foreground/5 shrink-0">
        <h3 className="font-semibold text-sm text-foreground">Details</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-foreground-50 hover:text-foreground hover:bg-foreground/5 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SessionMetadataContent
          session={session}
          onRenameSession={onRenameSession}
          onToggleFlag={onToggleFlag}
        />
      </div>
    </div>
  )
}

// ============================================================================
// SESSION METADATA CONTENT
// ============================================================================

interface SessionMetadataContentProps {
  session: Session
  onRenameSession: (name: string) => void
  onToggleFlag: () => void
}

function SessionMetadataContent({
  session,
  onRenameSession,
  onToggleFlag,
}: SessionMetadataContentProps) {
  const [name, setName] = useState(session.name || '')
  const nameTimeoutRef = useRef<NodeJS.Timeout>()

  // Sync local state when session changes
  useEffect(() => {
    setName(session.name || '')
  }, [session.id, session.name])

  // Debounced name update
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current)
    }
    nameTimeoutRef.current = setTimeout(() => {
      onRenameSession(value)
    }, 500)
  }, [onRenameSession])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
    }
  }, [])

  // Format token usage display
  const formatTokens = (count?: number) => {
    if (count === undefined) return '-'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className="p-4 space-y-6">
      {/* Name Section */}
      <div>
        <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Untitled"
          className={cn(
            'w-full px-3 py-2 rounded-lg border border-foreground/10 bg-transparent',
            'text-foreground placeholder:text-foreground-40',
            'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent',
            'transition-colors'
          )}
        />
      </div>

      {/* Flag Section */}
      <div>
        <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
          Status
        </label>
        <button
          onClick={onToggleFlag}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors w-full',
            session.isFlagged
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
              : 'border-foreground/10 bg-transparent text-foreground-50 hover:bg-foreground/5'
          )}
        >
          {session.isFlagged ? (
            <>
              <Flag className="w-4 h-4" />
              <span className="text-sm">Flagged</span>
            </>
          ) : (
            <>
              <FlagOff className="w-4 h-4" />
              <span className="text-sm">Not flagged</span>
            </>
          )}
        </button>
      </div>

      {/* Session Info */}
      <div className="pt-4 border-t border-foreground/5">
        <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
          Info
        </label>
        <div className="space-y-2 text-sm text-foreground-50">
          {session.lastMessageAt && (
            <div className="flex justify-between">
              <span>Last activity</span>
              <span className="text-foreground">
                {new Date(session.lastMessageAt).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Messages</span>
            <span className="text-foreground">
              {session.messages?.length || 0}
            </span>
          </div>
          {session.model && (
            <div className="flex justify-between">
              <span>Model</span>
              <span className="text-foreground">{session.model}</span>
            </div>
          )}
        </div>
      </div>

      {/* Token Usage */}
      {session.tokenUsage && (
        <div className="pt-4 border-t border-foreground/5">
          <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
            Token Usage
          </label>
          <div className="space-y-2 text-sm text-foreground-50">
            <div className="flex justify-between">
              <span>Input</span>
              <span className="text-foreground">
                {formatTokens(session.tokenUsage.inputTokens)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Output</span>
              <span className="text-foreground">
                {formatTokens(session.tokenUsage.outputTokens)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="text-foreground">
                {formatTokens(session.tokenUsage.totalTokens)}
              </span>
            </div>
            {session.tokenUsage.costUsd !== undefined && (
              <div className="flex justify-between">
                <span>Cost</span>
                <span className="text-foreground">
                  ${session.tokenUsage.costUsd.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

