import * as vscode from 'vscode';
import { v4 as uuidv4 } from '../utils';
import { 
  BuildlogFile, 
  BuildlogEvent, 
  BuildlogMetadata,
  FileSnapshot,
  PromptEventData,
  ResponseEventData,
  NoteEventData 
} from '../types';
import { FileWatcher } from './FileWatcher';
import { StateSnapshot } from './StateSnapshot';

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordingSessionOptions {
  workspaceRoot: string;
  workspaceName: string;
}

/**
 * Manages a recording session
 */
export class RecordingSession extends vscode.Disposable {
  private state: RecordingState = 'idle';
  private sessionId: string;
  private title: string = '';
  private startTime: Date | undefined;
  private events: BuildlogEvent[] = [];
  private initialSnapshots: FileSnapshot[] = [];
  private fileWatcher: FileWatcher;
  private stateSnapshot: StateSnapshot;
  private workspaceRoot: string;
  private workspaceName: string;

  private readonly _onStateChange = new vscode.EventEmitter<RecordingState>();
  readonly onStateChange = this._onStateChange.event;

  private readonly _onEvent = new vscode.EventEmitter<BuildlogEvent>();
  readonly onEvent = this._onEvent.event;

  constructor(options: RecordingSessionOptions) {
    super(() => this.dispose());
    
    this.sessionId = uuidv4();
    this.workspaceRoot = options.workspaceRoot;
    this.workspaceName = options.workspaceName;
    this.fileWatcher = new FileWatcher();
    this.stateSnapshot = new StateSnapshot(options.workspaceRoot);
  }

  /**
   * Start a new recording session
   */
  async start(title?: string): Promise<void> {
    if (this.state === 'recording') {
      throw new Error('Recording already in progress');
    }

    this.sessionId = uuidv4();
    this.title = title || `Recording ${new Date().toLocaleString()}`;
    this.startTime = new Date();
    this.events = [];

    // Capture initial state
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Starting recording...',
        cancellable: false,
      },
      async () => {
        this.initialSnapshots = await this.stateSnapshot.captureSnapshot();
        
        // Initialize file watcher with current state
        this.fileWatcher.initializeFromSnapshots(this.initialSnapshots);
        this.fileWatcher.start(event => this.handleEvent(event));
      }
    );

    this.setState('recording');
  }

  /**
   * Stop the recording and generate buildlog
   */
  async stop(): Promise<BuildlogFile> {
    if (this.state !== 'recording') {
      throw new Error('No recording in progress');
    }

    this.fileWatcher.stop();
    
    const endTime = new Date();
    const finalSnapshots = await this.stateSnapshot.captureSnapshot();

    // Count unique changed files
    const changedFiles = new Set<string>();
    for (const event of this.events) {
      if (event.type === 'file_change' && 'filePath' in event.data) {
        changedFiles.add((event.data as any).filePath);
      }
    }

    const metadata: BuildlogMetadata = {
      id: this.sessionId,
      title: this.title,
      startTime: this.startTime!.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - this.startTime!.getTime(),
      workspaceName: this.workspaceName,
      workspacePath: this.workspaceRoot,
      filesChanged: changedFiles.size,
      totalEvents: this.events.length,
    };

    const buildlog: BuildlogFile = {
      version: '1.0.0',
      metadata,
      events: this.events,
      snapshots: {
        initial: this.initialSnapshots,
        final: finalSnapshots,
      },
    };

    this.setState('idle');
    this.reset();

    return buildlog;
  }

  /**
   * Add a prompt event
   */
  addPrompt(content: string, model?: string): void {
    if (this.state !== 'recording') {
      return;
    }

    const data: PromptEventData = {
      type: 'prompt',
      content,
      model,
    };

    const event: BuildlogEvent = {
      id: uuidv4(),
      type: 'prompt',
      timestamp: new Date().toISOString(),
      data,
    };

    this.handleEvent(event);
  }

  /**
   * Add a response event
   */
  addResponse(content: string, model?: string): void {
    if (this.state !== 'recording') {
      return;
    }

    const data: ResponseEventData = {
      type: 'response',
      content,
      model,
    };

    const event: BuildlogEvent = {
      id: uuidv4(),
      type: 'response',
      timestamp: new Date().toISOString(),
      data,
    };

    this.handleEvent(event);
  }

  /**
   * Add a note event
   */
  addNote(content: string, tags?: string[]): void {
    if (this.state !== 'recording') {
      return;
    }

    const data: NoteEventData = {
      type: 'note',
      content,
      tags,
    };

    const event: BuildlogEvent = {
      id: uuidv4(),
      type: 'note',
      timestamp: new Date().toISOString(),
      data,
    };

    this.handleEvent(event);
  }

  /**
   * Handle an incoming event
   */
  private handleEvent(event: BuildlogEvent): void {
    this.events.push(event);
    this._onEvent.fire(event);
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
    if (!this.startTime) {
      return 0;
    }
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get the number of events recorded
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Get session title
   */
  getTitle(): string {
    return this.title;
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
    this.events = [];
    this.initialSnapshots = [];
    this.startTime = undefined;
    this.title = '';
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  dispose(): void {
    this.fileWatcher.dispose();
    this._onStateChange.dispose();
    this._onEvent.dispose();
  }
}
