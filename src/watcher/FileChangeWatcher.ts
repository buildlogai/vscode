import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';

/**
 * File Change Watcher
 * 
 * Automatically captures file modifications during recording.
 * When files change, we infer that an AI made changes and capture them.
 */
export class FileChangeWatcher extends vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | null = null;
  private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
  private getSession: () => RecordingSession | undefined;

  constructor(getSession: () => RecordingSession | undefined) {
    super(() => this.dispose());
    this.getSession = getSession;
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    console.log('[Buildlog FileWatcher] 🚀 START() CALLED');
    
    const session = this.getSession();
    if (!session) {
      console.log('[Buildlog FileWatcher] ❌ No session available');
      return;
    }

    // Watch all files in workspace
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*');
    console.log('[Buildlog FileWatcher] ✅ Created file system watcher for **/*');

    this.watcher.onDidChange((uri) => {
      console.log('[Buildlog FileWatcher] 🔄 onDidChange:', uri.fsPath);
      this.handleFileChange(uri, 'modified');
    });

    this.watcher.onDidCreate((uri) => {
      console.log('[Buildlog FileWatcher] ➕ onDidCreate:', uri.fsPath);
      this.handleFileChange(uri, 'created');
    });

    this.watcher.onDidDelete((uri) => {
      console.log('[Buildlog FileWatcher] ➖ onDidDelete:', uri.fsPath);
      this.handleFileChange(uri, 'deleted');
    });

    console.log('[Buildlog FileWatcher] 👀 Watching for file changes...');
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    this.pendingChanges.forEach(timeout => clearTimeout(timeout));
    this.pendingChanges.clear();
    console.log('[Buildlog FileWatcher] ⏹️  Stopped watching');
  }

  /**
   * Handle file changes (debounced)
   */
  private handleFileChange(uri: vscode.Uri, changeType: 'created' | 'modified' | 'deleted'): void {
    const session = this.getSession();
    if (!session || session.getState() !== 'recording') {
      return;
    }

    // Skip certain files
    const relativePath = vscode.workspace.asRelativePath(uri);
    if (this.shouldIgnoreFile(relativePath)) {
      return;
    }

    // Debounce: wait 2 seconds after last change before recording
    const existingTimeout = this.pendingChanges.get(relativePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.recordFileChange(relativePath, changeType);
      this.pendingChanges.delete(relativePath);
    }, 2000);

    this.pendingChanges.set(relativePath, timeout);
  }

  /**
   * Record a file change as an action
   */
  private recordFileChange(relativePath: string, changeType: 'created' | 'modified' | 'deleted'): void {
    const session = this.getSession();
    if (!session || session.getState() !== 'recording') {
      return;
    }

    let summary = '';
    const options: any = {};

    if (changeType === 'created') {
      summary = `Created ${relativePath}`;
      options.filesCreated = [relativePath];
    } else if (changeType === 'modified') {
      summary = `Modified ${relativePath}`;
      options.filesModified = [relativePath];
    } else if (changeType === 'deleted') {
      summary = `Deleted ${relativePath}`;
      options.filesDeleted = [relativePath];
    }

    console.log(`[Buildlog FileWatcher] 📝 Recording: ${summary}`);
    session.addAction(summary, options);
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnoreFile(path: string): boolean {
    const ignorePatterns = [
      '.buildlog/',
      'node_modules/',
      '.git/',
      'dist/',
      'out/',
      'build/',
      '.vscode/',
      '.DS_Store',
      '*.log',
      '*.buildlog',
    ];

    return ignorePatterns.some(pattern => {
      if (pattern.endsWith('/')) {
        return path.startsWith(pattern);
      }
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(path);
      }
      return path.includes(pattern);
    });
  }

  dispose(): void {
    this.stop();
  }
}
