/**
 * Credential Request Card
 *
 * Displays a credential/authentication request from a source
 * and allows the user to enter credentials or cancel.
 */

import React, { useState, useCallback } from 'react'
import { Key, User, Lock, Eye, EyeOff, Check, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import type { CredentialRequest, CredentialResponse } from '@craft-agent/shared/platform'

interface CredentialRequestCardProps {
  request: CredentialRequest
  onSubmit: (response: CredentialResponse) => void
  onCancel: () => void
  isSubmitting?: boolean
}

/**
 * Get credential label based on mode
 */
function getCredentialLabel(mode: CredentialRequest['mode']): string {
  switch (mode) {
    case 'bearer':
      return 'Bearer Token'
    case 'header':
      return 'API Key'
    case 'query':
      return 'API Key'
    case 'basic':
      return 'Credentials'
    default:
      return 'Credential'
  }
}

export function CredentialRequestCard({
  request,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CredentialRequestCardProps) {
  const [value, setValue] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const isBasicAuth = request.mode === 'basic'
  const isValid = isBasicAuth
    ? username.trim() && password.trim()
    : value.trim()

  const handleSubmit = useCallback(() => {
    if (!isValid) return

    if (isBasicAuth) {
      onSubmit({
        type: 'credential',
        username: username.trim(),
        password: password.trim(),
        cancelled: false,
      })
    } else {
      onSubmit({
        type: 'credential',
        value: value.trim(),
        cancelled: false,
      })
    }
  }, [isBasicAuth, username, password, value, isValid, onSubmit])

  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !isSubmitting) {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [isValid, isSubmitting, handleSubmit, handleCancel])

  const credentialLabel = getCredentialLabel(request.mode)

  return (
    <div className="overflow-hidden flex flex-col bg-background border border-border rounded-lg shadow-sm">
      {/* Content */}
      <div className="p-4 space-y-4 flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <Key className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Authentication Required
              </span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {request.sourceName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your credentials to connect to {request.sourceName}
            </p>
          </div>
        </div>

        {/* Input fields */}
        <div className="space-y-3">
          {isBasicAuth ? (
            <>
              {/* Username field */}
              <div className="space-y-1.5">
                <label htmlFor="credential-username" className="text-xs font-medium text-foreground">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="credential-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                    placeholder="Enter username"
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="credential-password" className="text-xs font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="credential-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9 pr-9"
                    placeholder="Enter password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Single credential field */
            <div className="space-y-1.5">
              <label htmlFor="credential-value" className="text-xs font-medium text-foreground">
                {credentialLabel}
                {request.mode === 'header' && request.headerName && (
                  <span className="text-muted-foreground ml-1">
                    ({request.headerName})
                  </span>
                )}
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="credential-value"
                  type={showPassword ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 pr-9"
                  placeholder={`Enter ${credentialLabel.toLowerCase()}`}
                  autoFocus
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-background/50">
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1.5"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          <Check className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>

        <div className="flex-1" />

        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          Credentials are stored securely
        </span>
      </div>
    </div>
  )
}
