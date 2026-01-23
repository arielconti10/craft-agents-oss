/**
 * App Sidebar - Main application sidebar using shadcn/ui pattern
 *
 * This sidebar provides navigation for the Craft Agents application with:
 * - Chat sessions with status filtering
 * - Flagged chats
 * - Sources management
 * - Skills overview
 * - Settings
 */

import React, { useState } from 'react'
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
  ChevronDown,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from './ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible'

// Navigation sections
export type NavSection = 'chats' | 'flagged' | 'sources' | 'skills' | 'settings'

// Session status types (matching shared/statuses)
export type SessionStatus = 'backlog' | 'todo' | 'needs-review' | 'done' | 'cancelled'

// Status display config
export const STATUS_CONFIG: Record<SessionStatus, { label: string; icon: typeof Circle; colorClass: string }> = {
  'backlog': { label: 'Backlog', icon: Inbox, colorClass: 'text-foreground-50' },
  'todo': { label: 'Todo', icon: Circle, colorClass: 'text-foreground' },
  'needs-review': { label: 'Needs Review', icon: CircleDot, colorClass: 'text-info' },
  'done': { label: 'Done', icon: CheckCircle, colorClass: 'text-accent' },
  'cancelled': { label: 'Cancelled', icon: XCircle, colorClass: 'text-foreground-50' },
}

export const STATUS_ORDER: SessionStatus[] = ['backlog', 'todo', 'needs-review', 'done', 'cancelled']

interface AppSidebarProps {
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

  // Platform info
  platformInfo?: string
}

function CraftAgentLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(3.4502, 3)" fill="currentColor">
        <path
          d="M3.17890888,3.6 L3.17890888,0 L16,0 L16,3.6 L3.17890888,3.6 Z M9.642,7.2 L9.64218223,10.8 L0,10.8 L0,3.6 L16,3.6 L16,7.2 L9.642,7.2 Z M3.17890888,18 L3.178,14.4 L0,14.4 L0,10.8 L16,10.8 L16,18 L3.17890888,18 Z"
          fillRule="nonzero"
        />
      </g>
    </svg>
  )
}

export function AppSidebar({
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
  platformInfo,
}: AppSidebarProps) {
  const { setOpenMobile } = useSidebar()
  const [isChatsOpen, setIsChatsOpen] = useState(true)

  const handleNavigation = (section: NavSection, status?: SessionStatus | 'all') => {
    onSectionChange(section)
    if (status !== undefined) {
      onStatusChange(status)
    }
    setOpenMobile(false)
  }

  return (
    <Sidebar>
      {/* Header with logo and new chat button */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-1">
          <CraftAgentLogo className="w-7 h-7 text-accent" />
          <span className="font-semibold text-sidebar-foreground">Craft Agents</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNewChat()
                setOpenMobile(false)
              }}
              className="bg-accent text-white hover:bg-accent/90 hover:text-white"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Chats with collapsible status submenu */}
              <Collapsible
                open={isChatsOpen}
                onOpenChange={setIsChatsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={activeSection === 'chats' && selectedStatus === 'all'}
                      onClick={() => handleNavigation('chats', 'all')}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>All Chats</span>
                      <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <SidebarMenuBadge>{sessionCount > 0 ? sessionCount : undefined}</SidebarMenuBadge>
                </SidebarMenuItem>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {STATUS_ORDER.map(status => {
                      const StatusIcon = STATUS_CONFIG[status].icon
                      const count = sessionCounts[status]
                      return (
                        <SidebarMenuSubItem key={status}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={activeSection === 'chats' && selectedStatus === status}
                          >
                            <button
                              onClick={() => handleNavigation('chats', status)}
                              className={`w-full ${
                                activeSection === 'chats' && selectedStatus === status
                                  ? ''
                                  : STATUS_CONFIG[status].colorClass
                              }`}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              <span>{STATUS_CONFIG[status].label}</span>
                              {count > 0 && (
                                <span className="ml-auto text-xs opacity-70">{count}</span>
                              )}
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>

              {/* Flagged */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === 'flagged'}
                  onClick={() => handleNavigation('flagged')}
                >
                  <Flag className="w-4 h-4" />
                  <span>Flagged</span>
                </SidebarMenuButton>
                {flaggedCount > 0 && <SidebarMenuBadge>{flaggedCount}</SidebarMenuBadge>}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Resources */}
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === 'sources'}
                  onClick={() => handleNavigation('sources')}
                >
                  <Plug className="w-4 h-4" />
                  <span>Sources</span>
                </SidebarMenuButton>
                {sourcesCount > 0 && <SidebarMenuBadge>{sourcesCount}</SidebarMenuBadge>}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === 'skills'}
                  onClick={() => handleNavigation('skills')}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Skills</span>
                </SidebarMenuButton>
                {skillsCount > 0 && <SidebarMenuBadge>{skillsCount}</SidebarMenuBadge>}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSection === 'settings'}
                  onClick={() => handleNavigation('settings')}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout}>
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {platformInfo && (
          <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
            {platformInfo}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
