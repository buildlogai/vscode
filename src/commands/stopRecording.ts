import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { BuildlogWriter } from '../buildlog/writer';
import { OutcomeStatus } from '../types';

/**
 * Stop the current recording and save the buildlog
 */
export async function stopRecording(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress.');
    return;
  }

  const stepCount = session.getStepCount();
  const promptCount = session.getPromptCount();

  // Warn if no prompts (not replicable)
  if (promptCount === 0) {
    const proceed = await vscode.window.showWarningMessage(
      `No prompts captured. This buildlog won't be replicable.\nContinue anyway?`,
      { modal: false },
      'Stop & Save',
      'Add Prompt First'
    );

    if (proceed === 'Add Prompt First') {
      vscode.commands.executeCommand('buildlog.addPrompt');
      return;
    }
    if (proceed !== 'Stop & Save') {
      return;
    }
  } else {
    // Normal confirmation
    const confirm = await vscode.window.showWarningMessage(
      `Stop recording? (${stepCount} steps, ${promptCount} prompts)`,
      { modal: false },
      'Stop & Save',
      'Cancel'
    );

    if (confirm !== 'Stop & Save') {
      return;
    }
  }

  // Ask for outcome status
  const statusChoice = await vscode.window.showQuickPick(
    [
      { label: '✅ Success', value: 'success' as OutcomeStatus },
      { label: '⚠️ Partial', value: 'partial' as OutcomeStatus },
      { label: '❌ Failure', value: 'failure' as OutcomeStatus },
      { label: '🚫 Abandoned', value: 'abandoned' as OutcomeStatus },
    ],
    { placeHolder: 'What was the outcome?' }
  );

  // Ask for summary
  const summary = await vscode.window.showInputBox({
    prompt: 'Brief summary of what was accomplished',
    placeHolder: 'e.g., Built a working React counter component',
    value: statusChoice?.value === 'success' ? 'Completed successfully' : undefined,
  });

  try {
    const buildlog = await session.stop({
      status: statusChoice?.value || 'abandoned',
      summary: summary || `Recorded ${stepCount} steps`,
    });

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    // Write the buildlog file
    const writer = new BuildlogWriter(workspaceFolder.uri.fsPath);
    const filePath = await writer.write(buildlog);

    // Show success message with stats
    const sizeKB = Math.round((await vscode.workspace.fs.stat(vscode.Uri.file(filePath))).size / 1024);
    const replicable = promptCount > 0 ? '✅ Replicable' : '⚠️ Not replicable';
    
    const action = await vscode.window.showInformationMessage(
      `📋 Buildlog saved (${sizeKB}KB, ${replicable})`,
      'Open File',
      'Copy Path'
    );

    if (action === 'Open File') {
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
    } else if (action === 'Copy Path') {
      await vscode.env.clipboard.writeText(filePath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to save recording: ${message}`);
  }
}
