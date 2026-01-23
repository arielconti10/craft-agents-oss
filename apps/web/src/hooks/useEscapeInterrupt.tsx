/**
 * useEscapeInterrupt - Double-Esc to interrupt AI processing
 *
 * When the user presses Escape twice quickly (within 500ms),
 * this triggers an interrupt callback to stop the AI.
 *
 * Shows a visual indicator on first press.
 */

import { useEffect, useCallback, useRef, useState } from 'react'

interface UseEscapeInterruptOptions {
  /** Whether interruption is enabled (e.g., only when AI is processing) */
  enabled: boolean
  /** Callback when double-Esc is detected */
  onInterrupt: () => void
  /** Time window for second Esc press (default: 500ms) */
  timeWindow?: number
}

interface UseEscapeInterruptResult {
  /** Whether we're waiting for second Esc press */
  isWaitingForSecondEsc: boolean
  /** Manually reset the waiting state */
  reset: () => void
}

export function useEscapeInterrupt({
  enabled,
  onInterrupt,
  timeWindow = 500,
}: UseEscapeInterruptOptions): UseEscapeInterruptResult {
  const [isWaitingForSecondEsc, setIsWaitingForSecondEsc] = useState(false)
  const lastEscTimeRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const reset = useCallback(() => {
    setIsWaitingForSecondEsc(false)
    lastEscTimeRef.current = 0
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      reset()
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return

      const now = Date.now()
      const timeSinceLastEsc = now - lastEscTimeRef.current

      if (timeSinceLastEsc < timeWindow && isWaitingForSecondEsc) {
        // Second Esc within time window - trigger interrupt
        e.preventDefault()
        e.stopPropagation()
        onInterrupt()
        reset()
      } else {
        // First Esc - start waiting for second
        lastEscTimeRef.current = now
        setIsWaitingForSecondEsc(true)

        // Reset after time window
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          setIsWaitingForSecondEsc(false)
        }, timeWindow)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, onInterrupt, timeWindow, isWaitingForSecondEsc, reset])

  return {
    isWaitingForSecondEsc,
    reset,
  }
}

// ============================================================================
// ESCAPE INTERRUPT OVERLAY COMPONENT
// ============================================================================

interface EscapeInterruptOverlayProps {
  isVisible: boolean
}

export function EscapeInterruptOverlay({ isVisible }: EscapeInterruptOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium shadow-lg">
        Press <kbd className="px-1.5 py-0.5 mx-1 bg-background/20 rounded text-xs font-mono">Esc</kbd> again to stop
      </div>
    </div>
  )
}
