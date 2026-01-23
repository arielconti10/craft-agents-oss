/**
 * Sheet Component - Slide-in panel using Vaul
 *
 * A shadcn-style sheet/drawer component for mobile navigation.
 * Supports left/right/top/bottom directions with proper animations.
 */

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from '@craft-agent/ui'

const Sheet = DrawerPrimitive.Root

const SheetTrigger = DrawerPrimitive.Trigger

const SheetClose = DrawerPrimitive.Close

const SheetPortal = DrawerPrimitive.Portal

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/50',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

interface SheetContentProps extends React.ComponentProps<typeof DrawerPrimitive.Content> {
  side?: 'left' | 'right' | 'top' | 'bottom'
  showHandle?: boolean
}

function SheetContent({
  className,
  children,
  side = 'right',
  showHandle = false,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DrawerPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-background shadow-lg',
          // Direction-specific styles
          side === 'right' && 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l',
          side === 'left' && 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r',
          side === 'top' && 'inset-x-0 top-0 h-auto max-h-[80vh] rounded-b-lg border-b',
          side === 'bottom' && 'inset-x-0 bottom-0 h-auto max-h-[80vh] rounded-t-lg border-t',
          // Animations
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'right' && 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          side === 'left' && 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          side === 'top' && 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
          side === 'bottom' && 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          'duration-200',
          className
        )}
        {...props}
      >
        {showHandle && (side === 'top' || side === 'bottom') && (
          <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-foreground/20" />
        )}
        {children}
      </DrawerPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 p-4 border-b border-foreground/5', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-auto flex flex-col gap-2 p-4 border-t border-foreground/5', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn('text-sm text-foreground-50', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
