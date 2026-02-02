import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RecordingSession } from '../recorder';

/**
 * Agent Feed Watcher
 * 
 * Watches a JSONL file (.buildlog/agent-feed.jsonl) for entries
 * appended by AI agents (like Copilot Agent mode).
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
  private feedPath: string;
  private lastPosition: number = 0;
  private getSession: () => RecordingSession | undefined;

  constructor(workspaceRoot: string, getSession: () => RecordingSession | undefined) {
    super(() => this.dispose());
    
    this.feedPath = path.join(workspaceRoot, '.buildlog', 'agent-feed.jsonl');
    this.getSession = getSession;
  }

  /**
   * Start watching the agent feed file
   */
  async start(): Promise<void> {
    // Ensure .buildlog directory exists
    const dir = path.dirname(this.feedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create or clear the feed file
    fs.writeFileSync(this.feedPath, '');
    this.lastPosition = 0;

    // Watch for changes
    this.watcher = fs.watch(this.feedPath, (eventType) => {
      if (eventType === 'change') {
        this.processNewLines();
      }
    });

    console.log(`Agent feed watcher started: ${this.feedPath}`);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Get the feed file path (for agents to know where to write)
   */
  getFeedPath(): string {
    return this.feedPath;
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
      const content = fs.readFileSync(this.feedPath, 'utf8');
      const newContent = content.substring(this.lastPosition);
      this.lastPosition = content.length;

      if (!newContent.trim()) return;

      const lines = newContent.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          this.addEntryToSession(session, entry);
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
    switch (entry.type) {
      case 'prompt':
        session.addPrompt(entry.content, {
          context: entry.context,
          intent: entry.intent,
        });
        console.log('Agent feed: Added prompt');
        break;

      case 'action':
        session.addAction(entry.summary, {
          filesCreated: entry.filesCreated,
          filesModified: entry.filesModified,
          filesDeleted: entry.filesDeleted,
          approach: entry.approach,
        });
        console.log('Agent feed: Added action');
        break;

      case 'note':
        session.addNote(entry.content, entry.category);
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
  content: string;
  context?: string[];
  intent?: string;
}

interface AgentFeedAction {
  type: 'action';
  summary: string;
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
