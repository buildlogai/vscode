import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { FileSnapshot } from '../types';

/**
 * Creates snapshots of files in the workspace
 */
export class StateSnapshot {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Create snapshots of all tracked files in the workspace
   */
  async captureSnapshot(patterns: string[] = ['**/*']): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];
    const excludePattern = '**/node_modules/**,**/.git/**,**/dist/**,**/.buildlog/**';

    for (const pattern of patterns) {
      const files = await vscode.workspace.findFiles(pattern, excludePattern, 1000);
      
      for (const file of files) {
        try {
          const snapshot = await this.captureFileSnapshot(file);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        } catch (error) {
          // Skip files that can't be read (binary files, etc.)
          console.warn(`Could not snapshot file: ${file.fsPath}`, error);
        }
      }
    }

    return snapshots;
  }

  /**
   * Capture a single file's snapshot
   */
  async captureFileSnapshot(uri: vscode.Uri): Promise<FileSnapshot | null> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      
      // Skip directories and large files (> 1MB)
      if (stat.type === vscode.FileType.Directory || stat.size > 1024 * 1024) {
        return null;
      }

      const content = await this.readFileContent(uri);
      if (content === null) {
        return null;
      }

      const relativePath = vscode.workspace.asRelativePath(uri, false);
      
      return {
        path: relativePath,
        content,
        hash: this.computeHash(content),
        size: stat.size,
        lastModified: new Date(stat.mtime).toISOString(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Read file content as string, returns null for binary files
   */
  private async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString('utf-8');
      
      // Check if file appears to be binary
      if (this.isBinaryContent(content)) {
        return null;
      }
      
      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Simple binary content detection
   */
  private isBinaryContent(content: string): boolean {
    // Check for null bytes which typically indicate binary content
    return content.includes('\0');
  }

  /**
   * Compute SHA-256 hash of content
   */
  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get a snapshot of a specific file by path
   */
  async getFileSnapshot(filePath: string): Promise<FileSnapshot | null> {
    const uri = vscode.Uri.file(filePath);
    return this.captureFileSnapshot(uri);
  }

  /**
   * Compare two snapshots and find changed files
   */
  static findChangedFiles(
    initial: FileSnapshot[],
    final: FileSnapshot[]
  ): { added: string[]; modified: string[]; deleted: string[] } {
    const initialMap = new Map(initial.map(s => [s.path, s]));
    const finalMap = new Map(final.map(s => [s.path, s]));

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // Find added and modified files
    for (const [path, finalSnapshot] of finalMap) {
      const initialSnapshot = initialMap.get(path);
      if (!initialSnapshot) {
        added.push(path);
      } else if (initialSnapshot.hash !== finalSnapshot.hash) {
        modified.push(path);
      }
    }

    // Find deleted files
    for (const path of initialMap.keys()) {
      if (!finalMap.has(path)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted };
  }
}
