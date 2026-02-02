import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';

/**
 * Add an action step to the recording
 * 
 * Actions describe what the AI did - summarizing the changes.
 * In slim format, we don't capture full diffs or responses.
 */
export async function addAction(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress. Start recording first.');
    return;
  }

  // Ask for a summary of what the AI did
  const summary = await vscode.window.showInputBox({
    prompt: 'What did the AI do?',
    placeHolder: 'e.g., Created a React counter component with useState',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Summary is required';
      }
      return null;
    },
  });

  if (!summary) {
    return;
  }

  // Ask about files affected
  const filesInput = await vscode.window.showInputBox({
    prompt: 'Which files were created or modified? (comma-separated, optional)',
    placeHolder: 'e.g., src/Counter.tsx, src/Counter.css',
  });

  let filesCreated: string[] | undefined;
  let filesModified: string[] | undefined;

  if (filesInput) {
    const files = filesInput.split(',').map(f => f.trim()).filter(f => f.length > 0);
    
    // Ask if these were created or modified
    if (files.length > 0) {
      const changeType = await vscode.window.showQuickPick(
        ['Created', 'Modified', 'Mix of both'],
        { placeHolder: 'Were these files created or modified?' }
      );

      if (changeType === 'Created') {
        filesCreated = files;
      } else if (changeType === 'Modified') {
        filesModified = files;
      } else if (changeType === 'Mix of both') {
        // For simplicity, mark all as modified in "mix" case
        filesModified = files;
      }
    }
  }

  session.addAction(summary, {
    filesCreated,
    filesModified,
  });
  
  vscode.window.showInformationMessage(`⚡ Action added: "${summary}"`);
}
