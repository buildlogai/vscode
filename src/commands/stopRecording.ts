import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { BuildlogWriter } from '../buildlog/writer';

/**
 * Stop the current recording and save the buildlog
 */
export async function stopRecording(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress.');
    return;
  }

  // Confirm before stopping
  const confirm = await vscode.window.showWarningMessage(
    `Stop recording? (${session.getEventCount()} events captured)`,
    { modal: false },
    'Stop & Save',
    'Cancel'
  );

  if (confirm !== 'Stop & Save') {
    return;
  }

  try {
    const buildlog = await session.stop();

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    // Write the buildlog file
    const writer = new BuildlogWriter(workspaceFolder.uri.fsPath);
    const filePath = await writer.write(buildlog);

    // Show success message with option to open the file
    const action = await vscode.window.showInformationMessage(
      `✅ Recording saved: ${vscode.workspace.asRelativePath(filePath)}`,
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
