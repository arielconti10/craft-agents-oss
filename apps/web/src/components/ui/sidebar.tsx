/**
 * Sidebar Components - shadcn/ui pattern
 *
 * A composable sidebar component following the shadcn/ui pattern:
 * - SidebarProvider for state management
 * - Sidebar with desktop/mobile responsive behavior
 * - Collapsible groups and menu items
 * - Sheet-based mobile navigation
 *
 * @see https://ui.shadcn.com/docs/components/sidebar
 */

import * as React from 'react'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { PanelLeft, ChevronRight } from 'lucide-react'
import { cn } from '@craft-agent/ui'
import { Sheet, SheetContent } from './sheet'

// ============================================================================
// Constants
// ============================================================================

const SIDEBAR_COOKIE_NAME = 'sidebar:state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SIDEBAR_WIDTH = '16rem' // 256px
const SIDEBAR_WIDTH_MOBILE = '18rem' // 288px
const SIDEBAR_WIDTH_ICON = '3rem' // 48px
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

// ============================================================================
// Sidebar Context
// ============================================================================

type SidebarState = 'expanded' | 'collapsed'

interface SidebarContextValue {
  state: SidebarState
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

// ============================================================================
// Sidebar Provider
// ============================================================================

interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const [isMobile, setIsMobile] = useState(false)

  // Check for mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Internal state for uncontrolled mode
  const [_open, _setOpen] = useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // Persist state to cookie
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Mobile sheet state
  const [openMobile, setOpenMobile] = useState(false)

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev)
    } else {
      setOpen((prev) => !prev)
    }
  }, [isMobile, setOpen])

  // Keyboard shortcut (Cmd/Ctrl + B)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const state: SidebarState = open ? 'expanded' : 'collapsed'

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        style={{
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
          ...style,
        } as React.CSSProperties}
        className={cn(
          'group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

// ============================================================================
// Sidebar
// ============================================================================

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
  collapsible?: 'offcanvas' | 'icon' | 'none'
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === 'none') {
    return (
      <div
        className={cn(
          'flex h-full w-[--sidebar-width] flex-col bg-foreground-2 text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  // Mobile: use Sheet
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} direction={side}>
        <SheetContent
          side={side}
          className="w-[--sidebar-width] bg-foreground-2 p-0 text-foreground [&>button]:hidden"
          style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: fixed sidebar
  return (
    <div
      className="group peer hidden md:block text-foreground"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
    >
      {/* Gap for fixed sidebar */}
      <div
        className={cn(
          'duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]'
            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]'
        )}
      />
      <div
        className={cn(
          'duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]'
            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className="flex h-full w-full flex-col bg-foreground-2 group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sidebar Trigger
// ============================================================================

interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function SidebarTrigger({ className, onClick, asChild = false, ...props }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar()
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-sidebar="trigger"
      className={cn('h-7 w-7', className)}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Comp>
  )
}

// ============================================================================
// Sidebar Structure Components
// ============================================================================

function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="separator"
      className={cn('mx-2 h-px bg-foreground/5', className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className
      )}
      {...props}
    />
  )
}

// ============================================================================
// Sidebar Group
// ============================================================================

function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-sidebar="group-label"
      className={cn(
        'duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="group-content" className={cn('w-full text-sm', className)} {...props} />
}

// ============================================================================
// Sidebar Menu
// ============================================================================

function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ReactNode
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const { state } = useSidebar()

  const button = (
    <Comp
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 active:bg-foreground/5 active:text-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-foreground/[0.07] data-[active=true]:font-medium data-[active=true]:text-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        // Size variants
        size === 'sm' && 'text-xs',
        size === 'lg' && 'text-sm group-data-[collapsible=icon]:!p-0',
        // Collapsed state
        'group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2',
        className
      )}
      {...props}
    />
  )

  if (!tooltip || state !== 'collapsed') {
    return button
  }

  // TODO: Add tooltip wrapper when collapsed
  return button
}

function SidebarMenuBadge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="menu-badge"
      className={cn(
        'absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-foreground/70 select-none pointer-events-none',
        'peer-hover/menu-button:text-foreground peer-data-[active=true]/menu-button:text-foreground',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

// ============================================================================
// Sidebar Menu Sub (Collapsible)
// ============================================================================

interface SidebarMenuSubProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

function SidebarMenuSub({ children, defaultOpen = false }: SidebarMenuSubProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div data-sidebar="menu-sub" data-state={open ? 'open' : 'closed'}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === SidebarMenuSubTrigger) {
            return React.cloneElement(child as React.ReactElement<SidebarMenuSubTriggerProps>, {
              open,
              onToggle: () => setOpen(!open),
            })
          }
          if (child.type === SidebarMenuSubContent) {
            return open ? child : null
          }
        }
        return child
      })}
    </div>
  )
}

interface SidebarMenuSubTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  open?: boolean
  onToggle?: () => void
  isActive?: boolean
}

function SidebarMenuSubTrigger({
  className,
  children,
  open,
  onToggle,
  isActive,
  ...props
}: SidebarMenuSubTriggerProps) {
  return (
    <button
      data-sidebar="menu-sub-trigger"
      data-state={open ? 'open' : 'closed'}
      data-active={isActive}
      className={cn(
        'flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 active:bg-foreground/5 active:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-foreground/[0.07] data-[active=true]:font-medium data-[active=true]:text-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        className
      )}
      onClick={onToggle}
      {...props}
    >
      {children}
      <ChevronRight
        className={cn(
          'ml-auto h-4 w-4 transition-transform duration-200',
          open && 'rotate-90'
        )}
      />
    </button>
  )
}

function SidebarMenuSubContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="menu-sub-content"
      className={cn(
        'ml-4 flex flex-col gap-1 border-l border-foreground/10 pl-2 pt-1',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sidebar="menu-sub-item"
      className={cn('', className)}
      {...props}
    />
  )
}

// ============================================================================
// Sidebar Inset
// ============================================================================

function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        'relative flex min-h-svh flex-1 flex-col bg-background',
        'peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
        className
      )}
      {...props}
    />
  )
}

// ============================================================================
// Exports
// ============================================================================

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubContent,
  SidebarMenuSubItem,
  SidebarMenuSubTrigger,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
