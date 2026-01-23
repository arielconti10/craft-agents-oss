/**
 * Permission Request Card
 *
 * Displays a permission request from the agent and allows
 * the user to approve or deny the action.
 */

import React from 'react'
import { Shield, Check, X, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import type { PermissionRequest } from '@craft-agent/shared/platform'

interface PermissionRequestCardProps {
  request: PermissionRequest
  onAllow: () => void
  onAlwaysAllow: () => void
  onDeny: () => void
  isResponding?: boolean
}

/**
 * Extract command and description from toolInput
 */
function getCommandInfo(toolInput: Record<string, unknown>): { command: string; description: string } {
  // Handle the format we send: { command, description }
  if (typeof toolInput.command === 'string') {
    return {
      command: toolInput.command,
      description: typeof toolInput.description === 'string' ? toolInput.description : '',
    }
  }

  // Fallback: stringify the input
  return {
    command: JSON.stringify(toolInput, null, 2),
    description: '',
  }
}

export function PermissionRequestCard({
  request,
  onAllow,
  onAlwaysAllow,
  onDeny,
  isResponding = false,
}: PermissionRequestCardProps) {
  const { command, description } = getCommandInfo(request.toolInput)

  return (
    <div className="overflow-hidden flex flex-col bg-amber-500/5 border border-amber-500/30 rounded-lg shadow-sm">
      {/* Content */}
      <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col">
        {/* Header with shield icon */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Permission Required
              </span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {request.toolName}
              </span>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        {/* Command preview */}
        {command && (
          <div className="bg-foreground/5 rounded-md p-3 font-mono text-xs text-foreground/90 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {command}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-background/50">
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1.5"
          onClick={onAllow}
          disabled={isResponding}
        >
          <Check className="h-3.5 w-3.5" />
          Allow
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={onAlwaysAllow}
          disabled={isResponding}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Always Allow
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDeny}
          disabled={isResponding}
        >
          <X className="h-3.5 w-3.5" />
          Deny
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Tip text */}
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          "Always Allow" remembers this for the session
        </span>
      </div>
    </div>
  )
}
