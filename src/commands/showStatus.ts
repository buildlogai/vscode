import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';

/**
 * Show recording status and statistics
 */
export async function showStatus(session: RecordingSession): Promise<void> {
  const state = session.getState();
  const isRecording = session.isRecording();
  
  if (!isRecording) {
    vscode.window.showInformationMessage(
      '⚪ Not recording. Use "Buildlog: Start Recording" to begin.'
    );
    return;
  }

  const stats = session.getStats();
  const message = [
    '🔴 Recording in progress',
    '',
    `Steps captured: ${stats.totalSteps}`,
    `  • Prompts: ${stats.prompts}`,
    `  • Actions: ${stats.actions}`,
    `  • Notes: ${stats.notes}`,
    `  • Others: ${stats.others}`,
    '',
    `Files: ${stats.filesModified} modified, ${stats.filesCreated} created`,
    '',
    stats.prompts > 0 
      ? '✅ This buildlog is replicable (has prompts)'
      : '⚠️ No prompts captured yet - buildlog won\'t be replicable',
  ].join('\n');

  const action = await vscode.window.showInformationMessage(
    message,
    { modal: true },
    'View Output',
    'Stop Recording'
  );

  if (action === 'View Output') {
    vscode.commands.executeCommand('workbench.action.output.toggleOutput');
  } else if (action === 'Stop Recording') {
    vscode.commands.executeCommand('buildlog.stopRecording');
  }
}
