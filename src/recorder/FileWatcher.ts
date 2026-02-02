import * as vscode from 'vscode';
import { DiffGenerator } from './DiffGenerator';
import { FileChangeEventData, BuildlogEvent } from '../types';
import { v4 as uuidv4 } from '../utils';

interface FileState {
  content: string;
  uri: vscode.Uri;
}

/**
 * Watches for file changes in the workspace
 */
export class FileWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private documentChangeListener: vscode.Disposable | undefined;
  private diffGenerator: DiffGenerator;
  private fileStates: Map<string, FileState> = new Map();
  private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
  private onEventCallback: ((event: BuildlogEvent) => void) | undefined;
  private debounceMs: number = 1000;

  constructor() {
    this.diffGenerator = new DiffGenerator();
  }

  /**
   * Start watching for file changes
   */
  start(onEvent: (event: BuildlogEvent) => void): void {
    this.onEventCallback = onEvent;

    // Watch for file system changes
    this.watcher = vscode.workspace.createFileSystemWatcher(
      '**/*',
      false, // Don't ignore creates
      false, // Don't ignore changes
      false  // Don't ignore deletes
    );

    this.watcher.onDidCreate(uri => this.handleFileCreate(uri));
    this.watcher.onDidChange(uri => this.handleFileChange(uri));
    this.watcher.onDidDelete(uri => this.handleFileDelete(uri));

    // Also listen for document changes for more immediate tracking
    this.documentChangeListener = vscode.workspace.onDidSaveTextDocument(
      doc => this.handleDocumentSave(doc)
    );
  }

  /**
   * Stop watching for changes
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }
    if (this.documentChangeListener) {
      this.documentChangeListener.dispose();
      this.documentChangeListener = undefined;
    }
    
    // Clear pending debounced changes
    for (const timeout of this.pendingChanges.values()) {
      clearTimeout(timeout);
    }
    this.pendingChanges.clear();
  }

  /**
   * Initialize file state from snapshots
   */
  initializeFromSnapshots(snapshots: { path: string; content: string }[]): void {
    this.fileStates.clear();
    
    for (const snapshot of snapshots) {
      const uri = this.getUriForPath(snapshot.path);
      this.fileStates.set(snapshot.path, {
        content: snapshot.content,
        uri,
      });
    }
  }

  /**
   * Handle file creation
   */
  private async handleFileCreate(uri: vscode.Uri): Promise<void> {
    if (this.shouldIgnoreFile(uri)) {
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(uri, false);
    
    try {
      const content = await this.readFileContent(uri);
      if (content === null) {
        return;
      }

      // Store the new file state
      this.fileStates.set(relativePath, { content, uri });

      // Generate create diff
      const diff = this.diffGenerator.generateCreateDiff(relativePath, content);
      
      this.emitEvent({
        type: 'file_change',
        filePath: relativePath,
        changeType: 'create',
        diff: diff.diff,
        linesAdded: diff.linesAdded,
        linesRemoved: diff.linesRemoved,
      });
    } catch (error) {
      console.error('Error handling file create:', error);
    }
  }

  /**
   * Handle file change (debounced)
   */
  private handleFileChange(uri: vscode.Uri): void {
    if (this.shouldIgnoreFile(uri)) {
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(uri, false);

    // Clear any pending change for this file
    const pending = this.pendingChanges.get(relativePath);
    if (pending) {
      clearTimeout(pending);
    }

    // Debounce the change
    const timeout = setTimeout(() => {
      this.processFileChange(uri, relativePath);
      this.pendingChanges.delete(relativePath);
    }, this.debounceMs);

    this.pendingChanges.set(relativePath, timeout);
  }

  /**
   * Process a file change after debounce
   */
  private async processFileChange(uri: vscode.Uri, relativePath: string): Promise<void> {
    try {
      const newContent = await this.readFileContent(uri);
      if (newContent === null) {
        return;
      }

      const oldState = this.fileStates.get(relativePath);
      const oldContent = oldState?.content ?? '';

      // Check if content actually changed
      if (!this.diffGenerator.hasChanges(oldContent, newContent)) {
        return;
      }

      // Generate diff
      const diff = this.diffGenerator.generateDiff(relativePath, oldContent, newContent);

      // Update stored state
      this.fileStates.set(relativePath, { content: newContent, uri });

      this.emitEvent({
        type: 'file_change',
        filePath: relativePath,
        changeType: 'modify',
        diff: diff.diff,
        linesAdded: diff.linesAdded,
        linesRemoved: diff.linesRemoved,
      });
    } catch (error) {
      console.error('Error processing file change:', error);
    }
  }

  /**
   * Handle file deletion
   */
  private handleFileDelete(uri: vscode.Uri): void {
    if (this.shouldIgnoreFile(uri)) {
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const oldState = this.fileStates.get(relativePath);
    
    if (oldState) {
      const diff = this.diffGenerator.generateDeleteDiff(relativePath, oldState.content);
      
      this.emitEvent({
        type: 'file_change',
        filePath: relativePath,
        changeType: 'delete',
        diff: diff.diff,
        linesAdded: 0,
        linesRemoved: diff.linesRemoved,
      });

      this.fileStates.delete(relativePath);
    }
  }

  /**
   * Handle document save (more immediate than file watcher)
   */
  private async handleDocumentSave(document: vscode.TextDocument): Promise<void> {
    if (this.shouldIgnoreFile(document.uri)) {
      return;
    }

    // Cancel any pending debounced change for this file
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    const pending = this.pendingChanges.get(relativePath);
    if (pending) {
      clearTimeout(pending);
      this.pendingChanges.delete(relativePath);
    }

    await this.processFileChange(document.uri, relativePath);
  }

  /**
   * Check if a file should be ignored
   */
  private shouldIgnoreFile(uri: vscode.Uri): boolean {
    const path = uri.fsPath;
    
    // Ignore common non-source files
    const ignorePatterns = [
      /node_modules/,
      /\.git/,
      /\.buildlog/,
      /dist\//,
      /out\//,
      /\.vsix$/,
      /\.log$/,
      /\.lock$/,
      /package-lock\.json$/,
    ];

    return ignorePatterns.some(pattern => pattern.test(path));
  }

  /**
   * Read file content
   */
  private async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString('utf-8');
      
      // Check for binary content
      if (content.includes('\0')) {
        return null;
      }
      
      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get URI for a relative path
   */
  private getUriForPath(relativePath: string): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
    }
    return vscode.Uri.file(relativePath);
  }

  /**
   * Emit a file change event
   */
  private emitEvent(data: FileChangeEventData): void {
    if (this.onEventCallback) {
      const event: BuildlogEvent = {
        id: uuidv4(),
        type: 'file_change',
        timestamp: new Date().toISOString(),
        data,
      };
      this.onEventCallback(event);
    }
  }

  /**
   * Get current file content for a path
   */
  getFileContent(path: string): string | undefined {
    return this.fileStates.get(path)?.content;
  }

  dispose(): void {
    this.stop();
    this.fileStates.clear();
  }
}
