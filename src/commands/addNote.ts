import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { showMultilineInput } from '../ui/MultilineInput';

/**
 * Add a note to the recording
 */
export async function addNote(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress. Start recording first.');
    return;
  }

  const content = await showMultilineInput({
    title: 'Add Note',
    placeholder: 'Add any notes about what you\'re doing...',
    saveLabel: 'Add Note',
  });

  if (!content) {
    return;
  }

  // Optionally ask for tags
  const tagsInput = await vscode.window.showInputBox({
    prompt: 'Add tags (comma-separated, optional)',
    placeHolder: 'e.g., bug-fix, refactor, feature',
  });

  const tags = tagsInput 
    ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : undefined;

  session.addNote(content, tags);
  
  const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
  vscode.window.showInformationMessage(`📌 Note added: "${preview}"`);
}
