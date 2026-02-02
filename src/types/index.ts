/**
 * Buildlog Types - Local type definitions (v2.0.0)
 * Slim workflow format - prompts are the artifact
 */

// =============================================================================
// FORMAT & VERSION
// =============================================================================

export const BUILDLOG_VERSION = '2.0.0';
export type BuildlogFormat = 'slim' | 'full';

export type EditorType = 'cursor' | 'vscode' | 'windsurf' | 'zed' | 'neovim' | 'jetbrains' | 'openclaw' | 'other';
export type AIProvider = 'claude' | 'gpt' | 'copilot' | 'gemini' | 'other';
export type NoteCategory = 'explanation' | 'tip' | 'warning' | 'decision' | 'todo';
export type TerminalOutcome = 'success' | 'failure' | 'partial';
export type OutcomeStatus = 'success' | 'partial' | 'failure' | 'abandoned';

// =============================================================================
// STEP TYPES (v2 - slim workflow)
// =============================================================================

interface BaseStep {
  id: string;
  timestamp: number; // seconds since recording start
  sequence: number;
}

export interface PromptStep extends BaseStep {
  type: 'prompt';
  content: string;
  context?: string[]; // file paths for context
  intent?: string;
}

export interface ActionStep extends BaseStep {
  type: 'action';
  summary: string; // "Created React counter component"
  filesCreated?: string[];
  filesModified?: string[];
  filesDeleted?: string[];
  packagesAdded?: string[];
  packagesRemoved?: string[];
  approach?: string;
  // Only in 'full' format:
  aiResponse?: string;
  diffs?: Record<string, string>;
}

export interface TerminalStep extends BaseStep {
  type: 'terminal';
  command: string;
  outcome: TerminalOutcome;
  summary?: string;
  // Only in 'full' format:
  output?: string;
  exitCode?: number;
}

export interface NoteStep extends BaseStep {
  type: 'note';
  content: string;
  category?: NoteCategory;
}

export interface CheckpointStep extends BaseStep {
  type: 'checkpoint';
  name: string;
  summary: string;
}

export interface ErrorStep extends BaseStep {
  type: 'error';
  message: string;
  resolution?: string;
  resolved: boolean;
}

export type BuildlogStep = 
  | PromptStep 
  | ActionStep 
  | TerminalStep 
  | NoteStep 
  | CheckpointStep 
  | ErrorStep;

export type StepType = BuildlogStep['type'];

// =============================================================================
// BUILDLOG FILE STRUCTURE (v2)
// =============================================================================

export interface BuildlogAuthor {
  name?: string;
  username?: string;
  url?: string;
}

export interface BuildlogMetadata {
  id: string;
  title: string;
  description?: string;
  author?: BuildlogAuthor;
  createdAt: string; // ISO 8601
  durationSeconds: number;
  editor: EditorType;
  aiProvider: AIProvider;
  model?: string;
  language?: string;
  framework?: string;
  tags?: string[];
  replicable: boolean;
  dependencies?: string[];
}

export interface BuildlogOutcome {
  status: OutcomeStatus;
  summary: string;
  filesCreated: number;
  filesModified: number;
  canReplicate: boolean;
  replicationNotes?: string;
}

export interface BuildlogFile {
  version: '2.0.0';
  format: BuildlogFormat;
  metadata: BuildlogMetadata;
  steps: BuildlogStep[];
  outcome: BuildlogOutcome;
}

// =============================================================================
// STEP ICONS & HELPERS
// =============================================================================

export const STEP_TYPE_ICONS: Record<StepType, string> = {
  prompt: '💬',
  action: '⚡',
  terminal: '🖥️',
  note: '📝',
  checkpoint: '🚩',
  error: '❌',
};

export function createEmptyBuildlog(
  metadata: Partial<BuildlogMetadata> & Pick<BuildlogMetadata, 'id' | 'title'>
): BuildlogFile {
  return {
    version: '2.0.0',
    format: 'slim',
    metadata: {
      createdAt: new Date().toISOString(),
      durationSeconds: 0,
      editor: 'vscode',
      aiProvider: 'copilot',
      replicable: false,
      ...metadata,
    },
    steps: [],
    outcome: {
      status: 'abandoned',
      summary: 'Recording in progress',
      filesCreated: 0,
      filesModified: 0,
      canReplicate: false,
    },
  };
}

export function detectEditor(): EditorType {
  // Try to detect the editor from environment or known identifiers
  const appName = process.env.VSCODE_GIT_ASKPASS_NODE || '';
  if (appName.toLowerCase().includes('cursor')) return 'cursor';
  if (appName.toLowerCase().includes('windsurf')) return 'windsurf';
  return 'vscode';
}

export function detectAIProvider(): AIProvider {
  // Default to copilot for VS Code
  return 'copilot';
}
