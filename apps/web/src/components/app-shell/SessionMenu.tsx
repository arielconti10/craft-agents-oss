/**
 * SessionMenu - Actions menu for sessions
 *
 * Provides session actions that work on both desktop (dropdown) and mobile (action sheet):
 * - Status change (todo states)
 * - Flag/Unflag
 * - Mark as Unread
 * - Rename
 * - Delete
 *
 * Desktop: Uses DropdownMenu triggered by "..." button
 * Mobile: Uses ActionSheet triggered by "..." button or long-press
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Flag,
  FlagOff,
  MailOpen,
  Circle,
  CircleDot,
  CheckCircle,
  XCircle,
  Inbox,
} from 'lucide-react'
import { cn } from '@craft-agent/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '../ui/dropdown-menu'
import { ActionSheet, ActionSheetItem, ActionSheetSeparator, ActionSheetGroup } from '../ui/action-sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog'

// ============================================================================
// TYPES
// ============================================================================

type SessionStatus = 'backlog' | 'todo' | 'needs-review' | 'done' | 'cancelled'

interface SessionMenuProps {
  sessionId: string
  sessionName: string
  isFlagged: boolean
  hasMessages: boolean
  hasUnreadMessages: boolean
  currentStatus: SessionStatus
  onStatusChange: (status: SessionStatus) => void
  onFlag: () => void
  onUnflag: () => void
  onMarkUnread: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  /** Render as icon button (default) or as a slot for custom trigger */
  children?: React.ReactNode
}

// Status configuration
const STATUS_CONFIG: Record<SessionStatus, { label: string; icon: React.ReactNode; colorClass: string }> = {
  'backlog': { label: 'Backlog', icon: <Inbox className="w-4 h-4" />, colorClass: 'text-foreground-50' },
  'todo': { label: 'Todo', icon: <Circle className="w-4 h-4" />, colorClass: 'text-foreground' },
  'needs-review': { label: 'Needs Review', icon: <CircleDot className="w-4 h-4" />, colorClass: 'text-info' },
  'done': { label: 'Done', icon: <CheckCircle className="w-4 h-4" />, colorClass: 'text-accent' },
  'cancelled': { label: 'Cancelled', icon: <XCircle className="w-4 h-4" />, colorClass: 'text-foreground-50' },
}

const STATUS_ORDER: SessionStatus[] = ['backlog', 'todo', 'needs-review', 'done', 'cancelled']

// ============================================================================
// COMPONENT
// ============================================================================

export function SessionMenu({
  sessionId,
  sessionName,
  isFlagged,
  hasMessages,
  hasUnreadMessages,
  currentStatus,
  onStatusChange,
  onFlag,
  onUnflag,
  onMarkUnread,
  onRename,
  onDelete,
  children,
}: SessionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(sessionName)

  // Detect if we're on mobile
  const [isMobile, setIsMobile] = useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleTriggerClick = useCallback(() => {
    if (isMobile) {
      setIsMobileSheetOpen(true)
    }
  }, [isMobile])

  const handleRenameClick = useCallback(() => {
    setRenameValue(sessionName)
    setIsRenameDialogOpen(true)
    setIsOpen(false)
    setIsMobileSheetOpen(false)
  }, [sessionName])

  const handleRenameSubmit = useCallback(() => {
    if (renameValue.trim()) {
      onRename(renameValue.trim())
      setIsRenameDialogOpen(false)
    }
  }, [renameValue, onRename])

  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true)
    setIsOpen(false)
    setIsMobileSheetOpen(false)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    onDelete()
    setIsDeleteDialogOpen(false)
  }, [onDelete])

  const handleFlagToggle = useCallback(() => {
    if (isFlagged) {
      onUnflag()
    } else {
      onFlag()
    }
    setIsOpen(false)
    setIsMobileSheetOpen(false)
  }, [isFlagged, onFlag, onUnflag])

  const handleMarkUnread = useCallback(() => {
    onMarkUnread()
    setIsOpen(false)
    setIsMobileSheetOpen(false)
  }, [onMarkUnread])

  const handleStatusChange = useCallback((status: SessionStatus) => {
    onStatusChange(status)
    setIsOpen(false)
    setIsMobileSheetOpen(false)
  }, [onStatusChange])

  // Trigger button
  const triggerButton = children || (
    <button
      onClick={handleTriggerClick}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
        'text-foreground-40 hover:text-foreground hover:bg-foreground/5',
        'md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100',
        (isOpen || isMobileSheetOpen) && 'opacity-100'
      )}
    >
      <MoreHorizontal className="w-4 h-4" />
    </button>
  )

  return (
    <>
      {/* Desktop: Dropdown Menu */}
      <div className="hidden md:block">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            {triggerButton}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Status submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className={cn('shrink-0', STATUS_CONFIG[currentStatus].colorClass)}>
                  {STATUS_CONFIG[currentStatus].icon}
                </span>
                <span className="flex-1">Status</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {STATUS_ORDER.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={currentStatus === status ? 'bg-foreground/5' : ''}
                  >
                    <span className={cn('shrink-0', STATUS_CONFIG[status].colorClass)}>
                      {STATUS_CONFIG[status].icon}
                    </span>
                    <span className="flex-1">{STATUS_CONFIG[status].label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Flag/Unflag */}
            <DropdownMenuItem onClick={handleFlagToggle}>
              {isFlagged ? (
                <>
                  <FlagOff className="w-4 h-4" />
                  <span className="flex-1">Unflag</span>
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4 text-info" />
                  <span className="flex-1">Flag</span>
                </>
              )}
            </DropdownMenuItem>

            {/* Mark as Unread */}
            {!hasUnreadMessages && hasMessages && (
              <DropdownMenuItem onClick={handleMarkUnread}>
                <MailOpen className="w-4 h-4" />
                <span className="flex-1">Mark as Unread</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Rename */}
            <DropdownMenuItem onClick={handleRenameClick}>
              <Pencil className="w-4 h-4" />
              <span className="flex-1">Rename</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Delete */}
            <DropdownMenuItem onClick={handleDeleteClick} variant="destructive">
              <Trash2 className="w-4 h-4" />
              <span className="flex-1">Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile: Action Sheet */}
      <div className="md:hidden">
        {triggerButton}
        <ActionSheet
          open={isMobileSheetOpen}
          onOpenChange={setIsMobileSheetOpen}
          title={sessionName || 'Session'}
        >
          {/* Status group */}
          <ActionSheetGroup label="Status">
            {STATUS_ORDER.map((status) => (
              <ActionSheetItem
                key={status}
                icon={<span className={STATUS_CONFIG[status].colorClass}>{STATUS_CONFIG[status].icon}</span>}
                onClick={() => handleStatusChange(status)}
                className={currentStatus === status ? 'bg-foreground/5' : ''}
              >
                {STATUS_CONFIG[status].label}
              </ActionSheetItem>
            ))}
          </ActionSheetGroup>

          <ActionSheetSeparator />

          {/* Flag/Unflag */}
          <ActionSheetItem
            icon={isFlagged ? <FlagOff className="w-5 h-5" /> : <Flag className="w-5 h-5 text-info" />}
            onClick={handleFlagToggle}
          >
            {isFlagged ? 'Unflag' : 'Flag'}
          </ActionSheetItem>

          {/* Mark as Unread */}
          {!hasUnreadMessages && hasMessages && (
            <ActionSheetItem icon={<MailOpen className="w-5 h-5" />} onClick={handleMarkUnread}>
              Mark as Unread
            </ActionSheetItem>
          )}

          <ActionSheetSeparator />

          {/* Rename */}
          <ActionSheetItem icon={<Pencil className="w-5 h-5" />} onClick={handleRenameClick}>
            Rename
          </ActionSheetItem>

          <ActionSheetSeparator />

          {/* Delete */}
          <ActionSheetItem icon={<Trash2 className="w-5 h-5" />} onClick={handleDeleteClick} variant="destructive">
            Delete
          </ActionSheetItem>
        </ActionSheet>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter a name..."
              className="w-full px-3 py-2.5 rounded-lg border border-foreground/15 bg-transparent text-foreground placeholder:text-foreground-40 focus:outline-none focus:ring-2 focus:ring-accent/50"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setIsRenameDialogOpen(false)
              }}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsRenameDialogOpen(false)}
              className="px-4 py-2.5 rounded-lg text-foreground hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRenameSubmit}
              disabled={!renameValue.trim()}
              className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{sessionName || 'this session'}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setIsDeleteDialogOpen(false)}
              className="px-4 py-2.5 rounded-lg text-foreground hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2.5 rounded-lg bg-destructive text-white font-medium hover:opacity-90 transition-opacity"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
