import * as vscode from 'vscode';
import { v4 as uuidv4 } from '../utils';
import { 
  BuildlogFile, 
  BuildlogStep, 
  BuildlogMetadata,
  BuildlogOutcome,
  PromptStep,
  ActionStep,
  TerminalStep,
  NoteStep,
  CheckpointStep,
  ErrorStep,
  NoteCategory,
  TerminalOutcome,
  OutcomeStatus,
  BUILDLOG_VERSION,
  detectEditor,
  detectAIProvider,
} from '../types';

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordingSessionOptions {
  workspaceRoot: string;
  workspaceName: string;
}

/**
 * Manages a recording session (v2 - slim workflow format)
 * 
 * Key change from v1: We no longer track file changes automatically.
 * Instead, users manually add steps representing their workflow.
 * The prompts are the artifact - code is ephemeral.
 */
export class RecordingSession extends vscode.Disposable {
  private state: RecordingState = 'idle';
  private sessionId: string;
  private title: string = '';
  private startTime: Date | undefined;
  private steps: BuildlogStep[] = [];
  private sequenceCounter: number = 0;
  private workspaceRoot: string;
  private workspaceName: string;
  
  // Track files for outcome summary
  private filesCreated = new Set<string>();
  private filesModified = new Set<string>();

  private readonly _onStateChange = new vscode.EventEmitter<RecordingState>();
  readonly onStateChange = this._onStateChange.event;

  private readonly _onStep = new vscode.EventEmitter<BuildlogStep>();
  readonly onStep = this._onStep.event;

  constructor(options: RecordingSessionOptions) {
    super(() => this.dispose());
    
    this.sessionId = uuidv4();
    this.workspaceRoot = options.workspaceRoot;
    this.workspaceName = options.workspaceName;
  }

  /**
   * Start a new recording session
   */
  async start(title?: string): Promise<void> {
    if (this.state === 'recording') {
      throw new Error('Recording already in progress');
    }

    this.sessionId = uuidv4();
    this.title = title || `Workflow ${new Date().toLocaleDateString()}`;
    this.startTime = new Date();
    this.steps = [];
    this.sequenceCounter = 0;
    this.filesCreated.clear();
    this.filesModified.clear();

    this.setState('recording');
  }

  /**
   * Stop the recording and generate buildlog
   */
  async stop(outcome?: {
    status: OutcomeStatus;
    summary: string;
  }): Promise<BuildlogFile> {
    if (this.state !== 'recording') {
      throw new Error('No recording in progress');
    }

    const endTime = new Date();
    const durationSeconds = Math.round((endTime.getTime() - this.startTime!.getTime()) / 1000);

    // Check if buildlog is replicable (has prompts)
    const hasPrompts = this.steps.some(s => s.type === 'prompt');

    const metadata: BuildlogMetadata = {
      id: this.sessionId,
      title: this.title,
      createdAt: this.startTime!.toISOString(),
      durationSeconds,
      editor: detectEditor(),
      aiProvider: detectAIProvider(),
      replicable: hasPrompts,
    };

    const buildlogOutcome: BuildlogOutcome = {
      status: outcome?.status || (hasPrompts ? 'success' : 'abandoned'),
      summary: outcome?.summary || `Recorded ${this.steps.length} steps`,
      filesCreated: this.filesCreated.size,
      filesModified: this.filesModified.size,
      canReplicate: hasPrompts,
    };

    const buildlog: BuildlogFile = {
      version: BUILDLOG_VERSION as '2.0.0',
      format: 'slim',
      metadata,
      steps: this.steps,
      outcome: buildlogOutcome,
    };

    this.setState('idle');
    this.reset();

    return buildlog;
  }

  /**
   * Add a prompt step (the primary artifact)
   */
  addPrompt(content: string, options?: {
    context?: string[];
    intent?: string;
  }): void {
    if (this.state !== 'recording') {
      console.log('[Buildlog] ⚠️  Skipped prompt - not recording');
      return;
    }

    const step: PromptStep = {
      id: uuidv4(),
      type: 'prompt',
      timestamp: this.getTimestamp(),
      sequence: this.sequenceCounter++,
      content,
      context: options?.context,
      intent: options?.intent,
    };

    console.log(`[Buildlog] ✅ Added PROMPT (#${step.sequence}): ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`);
    this.addStep(step);
  }

  /**
   * Add an action step (what the AI did)
   */
  addAction(summary: string, options?: {
    filesCreated?: string[];
    filesModified?: string[];
    filesDeleted?: string[];
    approach?: string;
  }): void {
    if (this.state !== 'recording') {
      console.log('[Buildlog] ⚠️  Skipped action - not recording');
      return;
    }

    // Track files for outcome
    options?.filesCreated?.forEach(f => this.filesCreated.add(f));
    options?.filesModified?.forEach(f => this.filesModified.add(f));

    const step: ActionStep = {
      id: uuidv4(),
      type: 'action',
      timestamp: this.getTimestamp(),
      sequence: this.sequenceCounter++,
      summary,
      filesCreated: options?.filesCreated,
      filesModified: options?.filesModified,
      filesDeleted: options?.filesDeleted,
      approach: options?.approach,
    };

    const filesInfo = options?.filesModified?.length ? ` [${options.filesModified.join(', ')}]` : '';
    console.log(`[Buildlog] ✅ Added ACTION (#${step.sequence}): ${summary}${filesInfo}`);
    this.addStep(step);
  }

  /**
   * Add a terminal step
   */
  addTerminal(command: string, outcome: TerminalOutcome, options?: {
    summary?: string;
    exitCode?: number;
  }): void {
    if (this.state !== 'recording') return;

    const step: TerminalStep = {
      id: uuidv4(),
      type: 'terminal',
      timestamp: this.getTimestamp(),
      sequence: this.sequenceCounter++,
      command,
      outcome,
      summary: options?.summary,
      exitCode: options?.exitCode,
    };

    this.addStep(step);
  }

  /**
   * Add a note step
   */
  addNote(content: string, category?: NoteCategory): void {
    if (this.state !== 'recording') {
      console.log('[Buildlog] ⚠️  Skipped note - not recording');
      return;
    }

    const step: NoteStep = {
      id: uuidv4(),
      type: 'note',
      timestamp: this.getTimestamp(),
      sequence: this.sequenceCounter++,
      content,
      category,
    };

    console.log(`[Buildlog] 📝 Added NOTE (#${step.sequence}): ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`);
    this.addStep(step);
  }

  /**
   * Add a checkpoint step
   */
  addCheckpoint(name: string, summary: string): void {
    if (this.state !== 'recording') return;

    const step: CheckpointStep = {
      id: uuidv4(),
      type: 'checkpoint',
      timestamp: this.getTimestamp(),
      sequence: this.sequenceCounter++,
      name,
      summary,
    };

    this.addStep(step);
  }

  /**
   * Add an error step
   */
  addError(message: string, resolved: boolean = false, resolution?: string): void {
    if (this.state !== 'recording') return;

    const step: ErrorStep = {
      id: uuidv4(),
      type: 'error',
      timestamp: this.getTimestamp(),
      sequence: this.sequenceCounter++,
      message,
      resolved,
      resolution,
    };

    this.addStep(step);
  }

  /**
   * Add a step to the recording
   */
  private addStep(step: BuildlogStep): void {
    this.steps.push(step);
    this._onStep.fire(step);
  }

  /**
   * Get timestamp in seconds since recording start
   */
  private getTimestamp(): number {
    if (!this.startTime) return 0;
    return Math.round((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get the current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get recording duration in milliseconds
   */
  getDuration(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get the number of steps recorded
   */
  getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Get the number of prompts recorded
   */
  getPromptCount(): number {
    return this.steps.filter(s => s.type === 'prompt').length;
  }

  /**
   * Get session title
   */
  getTitle(): string {
    return this.title;
  }

  /**
   * Set session title
   */
  setTitle(title: string): void {
    this.title = title;
  }

  /**
   * Set the recording state
   */
  private setState(state: RecordingState): void {
    this.state = state;
    this._onStateChange.fire(state);
  }

  /**
   * Reset the session
   */
  private reset(): void {
    this.steps = [];
    this.startTime = undefined;
    this.title = '';
    this.sequenceCounter = 0;
    this.filesCreated.clear();
    this.filesModified.clear();
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  /**
   * Get recording statistics
   */
  getStats() {
    const prompts = this.steps.filter(s => s.type === 'prompt').length;
    const actions = this.steps.filter(s => s.type === 'action').length;
    const notes = this.steps.filter(s => s.type === 'note').length;
    const others = this.steps.length - prompts - actions - notes;

    return {
      totalSteps: this.steps.length,
      prompts,
      actions,
      notes,
      others,
      filesCreated: this.filesCreated.size,
      filesModified: this.filesModified.size,
    };
  }

  dispose(): void {
    this._onStateChange.dispose();
    this._onStep.dispose();
  }
}
