import * as vscode from 'vscode';
import * as path from 'path';
import { BuildlogFile } from '../types';

/**
 * Writes buildlog files to the workspace
 */
export class BuildlogWriter {
  private workspaceRoot: string;
  private outputDir: string;

  constructor(workspaceRoot: string, outputDir: string = '.buildlog') {
    this.workspaceRoot = workspaceRoot;
    this.outputDir = outputDir;
  }

  /**
   * Write a buildlog to a file
   */
  async write(buildlog: BuildlogFile): Promise<string> {
    // Ensure output directory exists
    const outputPath = path.join(this.workspaceRoot, this.outputDir);
    const outputUri = vscode.Uri.file(outputPath);
    
    try {
      await vscode.workspace.fs.createDirectory(outputUri);
    } catch {
      // Directory might already exist
    }

    // Generate filename from title and timestamp
    const sanitizedTitle = this.sanitizeFilename(buildlog.metadata.title);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${sanitizedTitle}-${timestamp}.buildlog`;
    
    const filePath = path.join(outputPath, filename);
    const fileUri = vscode.Uri.file(filePath);

    // Write the buildlog as JSON
    const content = JSON.stringify(buildlog, null, 2);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

    return filePath;
  }

  /**
   * Sanitize a string for use as a filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'recording';
  }

  /**
   * List all buildlog files in the output directory
   */
  async listBuildlogs(): Promise<string[]> {
    const outputPath = path.join(this.workspaceRoot, this.outputDir);
    const outputUri = vscode.Uri.file(outputPath);

    try {
      const entries = await vscode.workspace.fs.readDirectory(outputUri);
      return entries
        .filter(([name, type]) => 
          type === vscode.FileType.File && name.endsWith('.buildlog')
        )
        .map(([name]) => path.join(outputPath, name));
    } catch {
      return [];
    }
  }

  /**
   * Read a buildlog file
   */
  async read(filePath: string): Promise<BuildlogFile | null> {
    try {
      const fileUri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(fileUri);
      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(content)) as BuildlogFile;
    } catch (error) {
      console.error('Failed to read buildlog:', error);
      return null;
    }
  }

  /**
   * Get the output directory path
   */
  getOutputDir(): string {
    return path.join(this.workspaceRoot, this.outputDir);
  }
}
