import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RecordingSession } from '../recorder';

/**
 * Global Agent Feed Path
 * Uses a fixed location in user's home directory so agents can always find it
 */
const GLOBAL_FEED_DIR = path.join(os.homedir(), '.buildlog');
const GLOBAL_FEED_PATH = path.join(GLOBAL_FEED_DIR, 'agent-feed.jsonl');

/**
 * Agent Feed Watcher
 * 
 * Watches ~/.buildlog/agent-feed.jsonl for entries appended by AI agents.
 * Uses a GLOBAL location (not workspace-specific) so agents always know where to write.
 * 
 * Agents can append lines like:
 * {"type":"prompt","content":"Build a CTA component"}
 * {"type":"action","summary":"Created CTA function","filesModified":["app.js"]}
 * {"type":"note","content":"User wanted hover effects"}
 * 
 * The watcher reads new lines and adds them to the active recording.
 */
export class AgentFeedWatcher extends vscode.Disposable {
  private watcher: fs.FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private inactivityInterval: NodeJS.Timeout | null = null;
  private lastPosition: number = 0;
  private lastMtime: number = 0;
  private lastEntryTime: number = 0;
  private hasWarnedInactivity: boolean = false;
  private entryCount: number = 0;
  private getSession: () => RecordingSession | undefined;
  
  // Event emitter for status updates
  private _onStatusChange = new vscode.EventEmitter<{ entryCount: number; lastEntryTime: number }>();
  public readonly onStatusChange = this._onStatusChange.event;

  constructor(getSession: () => RecordingSession | undefined) {
    super(() => this.dispose());
    this.getSession = getSession;
  }

  /**
   * Get the global feed path (for display to user)
   */
  static getFeedPath(): string {
    return GLOBAL_FEED_PATH;
  }

  /**
   * Start watching the agent feed file
   */
  async start(): Promise<void> {
    // Ensure ~/.buildlog directory exists
    if (!fs.existsSync(GLOBAL_FEED_DIR)) {
      fs.mkdirSync(GLOBAL_FEED_DIR, { recursive: true });
    }

    // Create or clear the feed file
    fs.writeFileSync(GLOBAL_FEED_PATH, '');
    this.lastPosition = 0;
    this.lastMtime = 0;
    this.lastEntryTime = Date.now();
    this.hasWarnedInactivity = false;
    this.entryCount = 0;

    // Use polling for reliability (fs.watch can be flaky on some systems)
    this.pollInterval = setInterval(() => {
      this.checkForChanges();
    }, 500); // Check every 500ms

    // Check for inactivity every 2 minutes
    this.inactivityInterval = setInterval(() => {
      this.checkInactivity();
    }, 120000); // 2 minutes

    // Also try fs.watch as a backup
    try {
      this.watcher = fs.watch(GLOBAL_FEED_PATH, (eventType) => {
        if (eventType === 'change') {
          this.processNewLines();
        }
      });
    } catch (e) {
      // fs.watch may fail on some systems, polling is the backup
      console.log('fs.watch not available, using polling only');
    }

    console.log(`Agent feed watcher started: ${GLOBAL_FEED_PATH}`);
    vscode.window.showInformationMessage(
      `🔴 Recording started. Agent feed: ~/.buildlog/agent-feed.jsonl`
    );
  }

  /**
   * Check for inactivity and warn user
   */
  private checkInactivity(): void {
    const session = this.getSession();
    if (!session || session.getState() !== 'recording') {
      return;
    }

    const timeSinceLastEntry = Date.now() - this.lastEntryTime;
    const twoMinutes = 2 * 60 * 1000;

    // Only warn once per session, and only if no entries have been logged
    if (timeSinceLastEntry > twoMinutes && !this.hasWarnedInactivity && this.entryCount === 0) {
      this.hasWarnedInactivity = true;
      vscode.window.showWarningMessage(
        '⚠️ Buildlog: No AI activity detected. Make sure your AI agent is logging to ~/.buildlog/agent-feed.jsonl',
        'Show Instructions',
        'Dismiss'
      ).then(choice => {
        if (choice === 'Show Instructions') {
          vscode.env.openExternal(vscode.Uri.parse('https://buildlog.ai/docs/agent-integration'));
        }
      });
    }
  }

  /**
   * Check for changes via polling (more reliable than fs.watch)
   */
  private checkForChanges(): void {
    try {
      const stats = fs.statSync(GLOBAL_FEED_PATH);
      if (stats.mtimeMs > this.lastMtime) {
        this.lastMtime = stats.mtimeMs;
        this.processNewLines();
      }
    } catch (e) {
      // File may not exist yet
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval);
      this.inactivityInterval = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Get the current entry count
   */
  getEntryCount(): number {
    return this.entryCount;
  }

  /**
   * Process new lines added to the feed file
   */
  private processNewLines(): void {
    const session = this.getSession();
    if (!session || session.getState() !== 'recording') {
      return;
    }

    try {
      const content = fs.readFileSync(GLOBAL_FEED_PATH, 'utf8');
      const newContent = content.substring(this.lastPosition);
      this.lastPosition = content.length;

      if (!newContent.trim()) return;

      const lines = newContent.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          this.addEntryToSession(session, entry);
          
          // Track entry for inactivity detection
          this.entryCount++;
          this.lastEntryTime = Date.now();
          this.hasWarnedInactivity = false; // Reset warning flag on new entry
          
          // Emit status change
          this._onStatusChange.fire({ 
            entryCount: this.entryCount, 
            lastEntryTime: this.lastEntryTime 
          });
        } catch (e) {
          console.warn('Invalid agent feed line:', line);
        }
      }
    } catch (e) {
      console.error('Error reading agent feed:', e);
    }
  }

  /**
   * Add an entry from the agent feed to the recording session
   */
  private addEntryToSession(session: RecordingSession, entry: AgentFeedEntry): void {
    console.log(`[Agent Feed] 📡 Processing entry: ${entry.type}`);
    switch (entry.type) {
      case 'prompt':
        // If raw is provided, use it as the full prompt content
        // Use content as the intent/summary
        // If only content is provided (no raw), use content as the full prompt
        const fullPrompt = entry.raw || entry.content;
        const promptIntent = entry.raw ? entry.content : entry.intent;
        
        session.addPrompt(fullPrompt, {
          context: entry.context,
          intent: promptIntent,
        });
        console.log('Agent feed: Added prompt' + (entry.raw ? ' (with raw)' : ''));
        break;

      case 'action':
        const actionSummary = entry.summary || entry.content || 'Action performed';
        session.addAction(actionSummary, {
          filesCreated: entry.filesCreated,
          filesModified: entry.filesModified,
          filesDeleted: entry.filesDeleted,
          approach: entry.approach,
        });
        console.log('Agent feed: Added action');
        break;

      case 'note':
        session.addNote(entry.content, entry.category as any);
        console.log('Agent feed: Added note');
        break;

      case 'error':
        session.addError(entry.message, entry.resolved, entry.resolution);
        console.log('Agent feed: Added error');
        break;

      case 'checkpoint':
        session.addCheckpoint(entry.name, entry.summary);
        console.log('Agent feed: Added checkpoint');
        break;

      default:
        console.warn('Unknown agent feed entry type:', (entry as any).type);
    }

    // Show notification
    vscode.window.setStatusBarMessage(`📝 Buildlog: Captured ${entry.type}`, 2000);
  }

  dispose(): void {
    this.stop();
  }
}

/**
 * Types for agent feed entries
 */
interface AgentFeedPrompt {
  type: 'prompt';
  content: string;           // Summary of the prompt (always required)
  raw?: string;              // Exact user prompt (up to 2000 chars)
  context?: string[];
  intent?: string;
}

interface AgentFeedAction {
  type: 'action';
  summary?: string;
  content?: string; // Fallback for summary (backward compat)
  filesCreated?: string[];
  filesModified?: string[];
  filesDeleted?: string[];
  approach?: string;
}

interface AgentFeedNote {
  type: 'note';
  content: string;
  category?: 'observation' | 'decision' | 'blocker' | 'idea' | 'reference';
}

interface AgentFeedError {
  type: 'error';
  message: string;
  resolved?: boolean;
  resolution?: string;
}

interface AgentFeedCheckpoint {
  type: 'checkpoint';
  name: string;
  summary: string;
}

type AgentFeedEntry = 
  | AgentFeedPrompt 
  | AgentFeedAction 
  | AgentFeedNote 
  | AgentFeedError 
  | AgentFeedCheckpoint;
