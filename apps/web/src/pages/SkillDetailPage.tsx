/**
 * Skill Detail Page
 *
 * Displays comprehensive information about a skill:
 * - Skill metadata (name, description, icon)
 * - File patterns (globs)
 * - Always-allowed tools
 * - Full instructions content
 */

import React from 'react'
import type { LoadedSkill } from '@craft-agent/shared/skills/types'
import {
  Wand2,
  FileCode,
  Wrench,
  BookOpen,
  FolderOpen,
  Check,
} from 'lucide-react'

interface SkillDetailPageProps {
  skill: LoadedSkill
  workspaceId: string | null
}

export function SkillDetailPage({ skill, workspaceId }: SkillDetailPageProps) {
  const { metadata, content, path } = skill

  // Check if skill has globs (file patterns)
  const hasGlobs = metadata.globs && metadata.globs.length > 0

  // Check if skill has always-allowed tools
  const hasAlwaysAllow = metadata.alwaysAllow && metadata.alwaysAllow.length > 0

  return (
    <div className="flex-1 min-h-0 bg-foreground-1.5 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-8 pb-safe space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            {metadata.icon && /^\p{Emoji}/u.test(metadata.icon) ? (
              <span className="text-2xl">{metadata.icon}</span>
            ) : (
              <Wand2 className="w-7 h-7 text-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{metadata.name}</h1>
            <p className="text-foreground-50">{skill.slug}</p>
            {metadata.description && (
              <p className="text-foreground-70 mt-2">{metadata.description}</p>
            )}
          </div>
        </div>

        {/* File Patterns Card */}
        {hasGlobs && (
          <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-accent" />
              File Patterns
            </h2>
            <p className="text-foreground-50 text-sm mb-4">
              This skill is automatically activated when working with files matching these patterns:
            </p>
            <div className="flex flex-wrap gap-2">
              {metadata.globs!.map((glob, index) => (
                <code
                  key={index}
                  className="px-3 py-1.5 bg-foreground/10 rounded-lg text-sm font-mono text-foreground"
                >
                  {glob}
                </code>
              ))}
            </div>
          </section>
        )}

        {/* Always Allowed Tools Card */}
        {hasAlwaysAllow && (
          <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-accent" />
              Always Allowed Tools
            </h2>
            <p className="text-foreground-50 text-sm mb-4">
              When this skill is active, these tools are automatically allowed without prompting:
            </p>
            <div className="space-y-2">
              {metadata.alwaysAllow!.map((tool, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5"
                >
                  <Check className="w-4 h-4 text-success shrink-0" />
                  <code className="font-mono text-sm text-foreground">{tool}</code>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
              <p className="text-xs text-foreground-40">
                Note: Always-allowed tools still respect the current permission mode.
                In "Safe" mode, these tools are still prompted. In "Ask" or "Allow All" mode,
                they execute without confirmation.
              </p>
            </div>
          </section>
        )}

        {/* Instructions Card */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            Instructions
          </h2>
          <p className="text-foreground-50 text-sm mb-4">
            These instructions are provided to Claude when the skill is active:
          </p>
          <div className="bg-foreground/5 rounded-lg p-4 max-h-96 overflow-y-auto">
            {content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {content}
                </pre>
              </div>
            ) : (
              <p className="text-foreground-40 text-sm italic">No instructions content</p>
            )}
          </div>
        </section>

        {/* Location Card */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            Location
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-foreground/5">
              <span className="text-foreground-50">Path</span>
              <code className="text-foreground font-mono text-sm truncate max-w-[400px]" title={path}>
                {path}
              </code>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-foreground-50">Slug</span>
              <span className="text-foreground">{skill.slug}</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
            <p className="text-xs text-foreground-40">
              Skills are defined by SKILL.md files in your workspace. Edit the file directly
              to modify the skill's instructions and metadata.
            </p>
          </div>
        </section>

        {/* How Skills Work Info */}
        <section className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4">How Skills Work</h2>
          <div className="space-y-4 text-sm text-foreground-70">
            <p>
              Skills are specialized instructions that extend Claude's capabilities for specific tasks.
              When a skill is active, its instructions are included in the system prompt.
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Skills can be activated:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Automatically based on file patterns (globs)</li>
                <li>Manually by mentioning the skill name</li>
                <li>Through session configuration</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Skills can define:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Custom instructions for specific domains</li>
                <li>Tools that should always be allowed</li>
                <li>File patterns for automatic activation</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
