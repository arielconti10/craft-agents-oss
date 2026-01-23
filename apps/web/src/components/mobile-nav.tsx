/**
 * Mobile Navigation Component
 *
 * A shadcn/ui v4 style mobile navigation using Popover with:
 * - Animated hamburger menu button that transforms to X
 * - Full-height popover with backdrop blur
 * - Organized navigation sections
 */

import React from 'react'
import {
  MessageSquare,
  Plug,
  Wand2,
  Settings,
  Flag,
  Plus,
  LogOut,
  Circle,
  CircleDot,
  CheckCircle,
  XCircle,
  Inbox,
} from 'lucide-react'
import { cn } from '@craft-agent/ui'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover'
import {
  type NavSection,
  type SessionStatus,
  STATUS_CONFIG,
  STATUS_ORDER,
} from './app-sidebar'

interface MobileNavProps {
  // Navigation
  activeSection: NavSection
  selectedStatus: SessionStatus | 'all'
  onSectionChange: (section: NavSection) => void
  onStatusChange: (status: SessionStatus | 'all') => void
  onNewChat: () => void
  onLogout: () => void

  // Counts
  sessionCount: number
  sessionCounts: Record<SessionStatus, number>
  flaggedCount: number
  sourcesCount: number
  skillsCount: number
}

export function MobileNav({
  activeSection,
  selectedStatus,
  onSectionChange,
  onStatusChange,
  onNewChat,
  onLogout,
  sessionCount,
  sessionCounts,
  flaggedCount,
  sourcesCount,
  skillsCount,
}: MobileNavProps) {
  const [open, setOpen] = React.useState(false)

  const handleNavigation = (section: NavSection, status?: SessionStatus | 'all') => {
    onSectionChange(section)
    if (status !== undefined) {
      onStatusChange(status)
    }
    setOpen(false)
  }

  const handleNewChat = () => {
    onNewChat()
    setOpen(false)
  }

  const handleLogout = () => {
    onLogout()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-8 items-center justify-start gap-2.5 p-0 hover:bg-transparent focus-visible:outline-none active:bg-transparent"
        >
          {/* Animated hamburger icon */}
          <div className="relative flex h-8 w-4 items-center justify-center">
            <div className="relative size-4">
              <span
                className={cn(
                  'absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-100',
                  open ? 'top-[0.4rem] -rotate-45' : 'top-1'
                )}
              />
              <span
                className={cn(
                  'absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-100',
                  open ? 'top-[0.4rem] rotate-45' : 'top-2.5'
                )}
              />
            </div>
            <span className="sr-only">Toggle Menu</span>
          </div>
          <span className="flex h-8 items-center text-lg font-medium leading-none text-foreground">
            Menu
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="h-[var(--radix-popper-available-height)] w-[var(--radix-popper-available-width)] overflow-y-auto rounded-none border-none bg-background/95 p-0 shadow-none backdrop-blur-lg duration-100"
        align="start"
        side="bottom"
        alignOffset={-16}
        sideOffset={14}
      >
        <div className="flex flex-col gap-10 overflow-auto px-6 py-6">
          {/* Quick Actions */}
          <div className="flex flex-col gap-4">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-3 text-xl font-medium text-accent"
            >
              <Plus className="w-5 h-5" />
              New Chat
            </button>
          </div>

          {/* Navigation Section */}
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium text-foreground-50">
              Navigation
            </div>
            <div className="flex flex-col gap-3">
              <MobileNavLink
                onClick={() => handleNavigation('chats', 'all')}
                isActive={activeSection === 'chats' && selectedStatus === 'all'}
              >
                <MessageSquare className="w-5 h-5" />
                All Chats
                {sessionCount > 0 && (
                  <span className="ml-auto text-base text-foreground-50">{sessionCount}</span>
                )}
              </MobileNavLink>

              <MobileNavLink
                onClick={() => handleNavigation('flagged')}
                isActive={activeSection === 'flagged'}
              >
                <Flag className="w-5 h-5" />
                Flagged
                {flaggedCount > 0 && (
                  <span className="ml-auto text-base text-foreground-50">{flaggedCount}</span>
                )}
              </MobileNavLink>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium text-foreground-50">
              By Status
            </div>
            <div className="flex flex-col gap-3">
              {STATUS_ORDER.map(status => {
                const StatusIcon = STATUS_CONFIG[status].icon
                const count = sessionCounts[status]
                const isActive = activeSection === 'chats' && selectedStatus === status
                return (
                  <MobileNavLink
                    key={status}
                    onClick={() => handleNavigation('chats', status)}
                    isActive={isActive}
                    className={!isActive ? STATUS_CONFIG[status].colorClass : ''}
                  >
                    <StatusIcon className="w-5 h-5" />
                    {STATUS_CONFIG[status].label}
                    {count > 0 && (
                      <span className="ml-auto text-base opacity-70">{count}</span>
                    )}
                  </MobileNavLink>
                )
              })}
            </div>
          </div>

          {/* Resources Section */}
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium text-foreground-50">
              Resources
            </div>
            <div className="flex flex-col gap-3">
              <MobileNavLink
                onClick={() => handleNavigation('sources')}
                isActive={activeSection === 'sources'}
              >
                <Plug className="w-5 h-5" />
                Sources
                {sourcesCount > 0 && (
                  <span className="ml-auto text-base text-foreground-50">{sourcesCount}</span>
                )}
              </MobileNavLink>

              <MobileNavLink
                onClick={() => handleNavigation('skills')}
                isActive={activeSection === 'skills'}
              >
                <Wand2 className="w-5 h-5" />
                Skills
                {skillsCount > 0 && (
                  <span className="ml-auto text-base text-foreground-50">{skillsCount}</span>
                )}
              </MobileNavLink>

              <MobileNavLink
                onClick={() => handleNavigation('settings')}
                isActive={activeSection === 'settings'}
              >
                <Settings className="w-5 h-5" />
                Settings
              </MobileNavLink>
            </div>
          </div>

          {/* Logout */}
          <div className="flex flex-col gap-4 pt-4 border-t border-foreground/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 text-xl font-medium text-foreground-50 hover:text-foreground transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MobileNavLink({
  onClick,
  isActive,
  className,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 text-xl font-medium transition-colors',
        isActive ? 'text-accent' : 'text-foreground hover:text-accent',
        className
      )}
    >
      {children}
    </button>
  )
}
