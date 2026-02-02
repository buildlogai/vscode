import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { ensureCopilotInstructions } from '../agent/CopilotInstructions';

/**
 * Start a new recording session
 */
export async function startRecording(session: RecordingSession): Promise<void> {
  if (session.isRecording()) {
    vscode.window.showWarningMessage('Recording is already in progress.');
    return;
  }

  // Ensure copilot instructions exist in workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    await ensureCopilotInstructions(workspaceFolder.uri.fsPath);
  }

  // Ask for a session title
  const title = await vscode.window.showInputBox({
    prompt: 'Enter a title for this recording session',
    placeHolder: 'e.g., Implement user authentication',
    value: `Recording ${new Date().toLocaleDateString()}`,
  });

  if (title === undefined) {
    // User cancelled
    return;
  }

  try {
    await session.start(title);
    vscode.window.showInformationMessage(`🔴 Recording started: ${title}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to start recording: ${message}`);
  }
}
