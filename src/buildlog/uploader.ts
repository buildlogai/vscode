import * as vscode from 'vscode';
import { BuildlogFile } from '../types';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface UploaderConfig {
  apiEndpoint: string;
  apiKey?: string;
}

/**
 * Uploads buildlog files to a remote server
 */
export class BuildlogUploader {
  private config: UploaderConfig;

  constructor(config?: Partial<UploaderConfig>) {
    this.config = {
      apiEndpoint: config?.apiEndpoint || 'https://api.buildlog.dev/v1/upload',
      apiKey: config?.apiKey,
    };
  }

  /**
   * Upload a buildlog to the server
   */
  async upload(buildlog: BuildlogFile): Promise<UploadResult> {
    try {
      // Get API key from configuration if not provided
      const apiKey = this.config.apiKey || 
        vscode.workspace.getConfiguration('buildlog').get<string>('apiKey');

      if (!apiKey) {
        return {
          success: false,
          error: 'No API key configured. Set buildlog.apiKey in settings.',
        };
      }

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildlog),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Upload failed: ${response.status} ${errorText}`,
        };
      }

      const result = await response.json() as { url: string };
      
      return {
        success: true,
        url: result.url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Upload failed: ${message}`,
      };
    }
  }

  /**
   * Upload a buildlog file with progress reporting
   */
  async uploadWithProgress(buildlog: BuildlogFile): Promise<UploadResult> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Uploading buildlog...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Preparing upload...' });
        
        const result = await this.upload(buildlog);
        
        if (result.success) {
          progress.report({ increment: 100, message: 'Upload complete!' });
        } else {
          progress.report({ increment: 100, message: 'Upload failed' });
        }
        
        return result;
      }
    );
  }

  /**
   * Check if upload is configured and available
   */
  isConfigured(): boolean {
    const apiKey = this.config.apiKey || 
      vscode.workspace.getConfiguration('buildlog').get<string>('apiKey');
    return !!apiKey;
  }
}
