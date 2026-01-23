/**
 * RightSidebar - Session metadata panel
 *
 * Displays and allows editing of:
 * - Session name
 * - Session notes
 * - Associated files (read-only)
 *
 * Mobile: Uses a bottom sheet
 * Desktop: Shows as a right panel
 */

import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, FileText, ChevronRight, StickyNote } from 'lucide-react'
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
  onUpdateSession: (updates: { name?: string; notes?: string }) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RightSidebar({
  session,
  isOpen,
  onClose,
  onUpdateSession,
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
              onUpdateSession={onUpdateSession}
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
          onUpdateSession={onUpdateSession}
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
  onUpdateSession: (updates: { name?: string; notes?: string }) => void
}

function SessionMetadataContent({
  session,
  onUpdateSession,
}: SessionMetadataContentProps) {
  const [name, setName] = useState(session.name || '')
  const [notes, setNotes] = useState(session.notes || '')
  const nameTimeoutRef = useRef<NodeJS.Timeout>()
  const notesTimeoutRef = useRef<NodeJS.Timeout>()

  // Sync local state when session changes
  useEffect(() => {
    setName(session.name || '')
    setNotes(session.notes || '')
  }, [session.id, session.name, session.notes])

  // Debounced name update
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current)
    }
    nameTimeoutRef.current = setTimeout(() => {
      onUpdateSession({ name: value })
    }, 500)
  }, [onUpdateSession])

  // Debounced notes update
  const handleNotesChange = useCallback((value: string) => {
    setNotes(value)
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current)
    }
    notesTimeoutRef.current = setTimeout(() => {
      onUpdateSession({ notes: value })
    }, 500)
  }, [onUpdateSession])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current)
    }
  }, [])

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

      {/* Notes Section */}
      <div>
        <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
          <StickyNote className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this session..."
          rows={6}
          className={cn(
            'w-full px-3 py-2 rounded-lg border border-foreground/10 bg-transparent',
            'text-foreground placeholder:text-foreground-40 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent',
            'transition-colors resize-none'
          )}
        />
      </div>

      {/* Files Section */}
      {session.files && session.files.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
            <FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Files ({session.files.length})
          </label>
          <div className="space-y-1">
            {session.files.map((file, index) => (
              <FileItem key={index} path={file} />
            ))}
          </div>
        </div>
      )}

      {/* Session Info */}
      <div className="pt-4 border-t border-foreground/5">
        <label className="block text-xs font-medium text-foreground-50 uppercase tracking-wider mb-2">
          Info
        </label>
        <div className="space-y-2 text-sm text-foreground-50">
          <div className="flex justify-between">
            <span>Created</span>
            <span className="text-foreground">
              {session.createdAt
                ? new Date(session.createdAt).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
          {session.lastMessageAt && (
            <div className="flex justify-between">
              <span>Last message</span>
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
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// FILE ITEM
// ============================================================================

function FileItem({ path }: { path: string }) {
  const fileName = path.split('/').pop() || path

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left',
        'text-sm text-foreground hover:bg-foreground/5 transition-colors',
        'group'
      )}
      onClick={() => {
        // Could open file viewer or copy path
        navigator.clipboard.writeText(path)
      }}
      title={path}
    >
      <FileText className="w-4 h-4 text-foreground-40 shrink-0" />
      <span className="truncate flex-1">{fileName}</span>
      <ChevronRight className="w-3 h-3 text-foreground-30 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
