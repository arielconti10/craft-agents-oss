/**
 * Sidebar Components - shadcn-style sidebar with collapsible sections
 *
 * Based on shadcn's sidebar component pattern with:
 * - Collapsible navigation groups
 * - Icon + label items
 * - Badge support
 * - Mobile sheet integration
 */

import * as React from 'react'
import { createContext, useContext, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@craft-agent/ui'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './sheet'

// ============================================================================
// Sidebar Context
// ============================================================================

interface SidebarContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}

// ============================================================================
// Sidebar Provider
// ============================================================================

interface SidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function SidebarProvider({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: SidebarProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [isMobile, setIsMobile] = useState(false)

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isOpen = controlledOpen ?? uncontrolledOpen
  const setIsOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, isMobile }}>
      {children}
    </SidebarContext.Provider>
  )
}

// ============================================================================
// Sidebar Components
// ============================================================================

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'left' | 'right'
}

function Sidebar({ className, side = 'left', children, ...props }: SidebarProps) {
  const { isOpen, setIsOpen, isMobile } = useSidebar()

  // Mobile: render as sheet
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen} direction={side}>
        <SheetContent side={side} className="w-72 p-0">
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: render as fixed sidebar
  return (
    <div
      className={cn(
        'flex h-full w-64 flex-col bg-foreground-2 border-r border-foreground/5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-2 p-4 border-b border-foreground/5', className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto py-2', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('p-4 border-t border-foreground/5', className)}
      {...props}
    />
  )
}

// ============================================================================
// Sidebar Navigation Components
// ============================================================================

function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-2 py-1', className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-2 py-1.5 text-xs font-medium text-foreground-40 uppercase tracking-wider',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('space-y-0.5', className)}
      {...props}
    />
  )
}

// ============================================================================
// Sidebar Menu Components
// ============================================================================

function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn('space-y-0.5', className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn('', className)}
      {...props}
    />
  )
}

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean
  tooltip?: string
}

function SidebarMenuButton({
  className,
  isActive,
  children,
  ...props
}: SidebarMenuButtonProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
        'hover:bg-foreground/5 active:bg-foreground/10',
        isActive && 'bg-accent text-white hover:bg-accent/90',
        !isActive && 'text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function SidebarMenuBadge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'ml-auto text-xs font-medium',
        className
      )}
      {...props}
    />
  )
}

// ============================================================================
// Collapsible Sidebar Menu
// ============================================================================

interface SidebarMenuSubProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

function SidebarMenuSub({ children, defaultOpen = false }: SidebarMenuSubProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="space-y-0.5">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === SidebarMenuSubTrigger) {
            return React.cloneElement(child as React.ReactElement<SidebarMenuSubTriggerProps>, {
              isOpen,
              onToggle: () => setIsOpen(!isOpen),
            })
          }
          if (child.type === SidebarMenuSubContent) {
            return isOpen ? child : null
          }
        }
        return child
      })}
    </div>
  )
}

interface SidebarMenuSubTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOpen?: boolean
  onToggle?: () => void
  isActive?: boolean
}

function SidebarMenuSubTrigger({
  className,
  children,
  isOpen,
  onToggle,
  isActive,
  ...props
}: SidebarMenuSubTriggerProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
        'hover:bg-foreground/5 active:bg-foreground/10',
        isActive && 'bg-accent text-white hover:bg-accent/90',
        !isActive && 'text-foreground',
        className
      )}
      onClick={onToggle}
      {...props}
    >
      {children}
      <ChevronRight
        className={cn(
          'ml-auto h-4 w-4 transition-transform duration-200',
          isOpen && 'rotate-90'
        )}
      />
    </button>
  )
}

function SidebarMenuSubContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('ml-4 space-y-0.5 border-l border-foreground/10 pl-2', className)}
      {...props}
    />
  )
}

export {
  SidebarProvider,
  useSidebar,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubTrigger,
  SidebarMenuSubContent,
}
