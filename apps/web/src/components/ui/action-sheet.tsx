/**
 * ActionSheet Component
 *
 * Mobile-friendly action menu that slides up from the bottom.
 * Uses the Sheet component with pre-configured styling for action menus.
 */

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet'
import { cn } from '@craft-agent/ui'

interface ActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
}

export function ActionSheet({ open, onOpenChange, title, children }: ActionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-0 pb-8 max-h-[85vh]">
        {title && (
          <SheetHeader className="px-4 pb-2 border-b border-foreground/5">
            <SheetTitle className="text-center text-base">{title}</SheetTitle>
          </SheetHeader>
        )}
        <div className="overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface ActionSheetItemProps {
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
  className?: string
}

export function ActionSheetItem({
  icon,
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
}: ActionSheetItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 text-left text-[15px] transition-colors',
        'active:bg-foreground/5 disabled:opacity-50 disabled:pointer-events-none',
        variant === 'destructive' && 'text-destructive',
        className
      )}
    >
      {icon && (
        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </button>
  )
}

export function ActionSheetSeparator() {
  return <div className="h-px bg-foreground/5 my-1" />
}

interface ActionSheetGroupProps {
  children: React.ReactNode
  label?: string
}

export function ActionSheetGroup({ children, label }: ActionSheetGroupProps) {
  return (
    <div className="py-1">
      {label && (
        <div className="px-4 py-2 text-xs font-medium text-foreground-40 uppercase tracking-wider">
          {label}
        </div>
      )}
      {children}
    </div>
  )
}
