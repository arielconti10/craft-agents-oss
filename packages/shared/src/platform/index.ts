/**
 * Platform abstraction layer
 *
 * This module provides a platform-agnostic API that can be implemented
 * by both Electron (desktop) and Web (browser) platforms.
 *
 * Usage:
 *
 * ```typescript
 * // In Electron app
 * import { createElectronPlatform } from '@craft-agent/shared/platform/electron'
 * const { api, capabilities } = createElectronPlatform()
 *
 * // In Web app
 * import { createWebPlatform } from '@craft-agent/shared/platform/web'
 * const { api, capabilities } = createWebPlatform({ baseUrl: '/api' })
 *
 * // In shared components
 * import type { PlatformAPI, PlatformCapabilities } from '@craft-agent/shared/platform'
 * ```
 */

// Export types
export type {
  PlatformAPI,
  PlatformCapabilities,
  PlatformContext,
  Session,
  CreateSessionOptions,
  FileAttachment,
  SendMessageOptions,
  SessionCommand,
  ShareResult,
  RefreshTitleResult,
  PermissionRequest,
  CredentialInputMode,
  CredentialRequest,
  CredentialResponse,
  OAuthResult,
  McpToolsResult,
  BillingMethodInfo,
  WorkspaceSettings,
  SessionEvent,
  TodoState,
  PermissionMode,
  ThinkingLevel,
} from './types'

// Re-export platform implementations
// These are in separate files to allow tree-shaking
// (web app won't bundle electron code and vice versa)
