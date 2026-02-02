import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { showMultilineInput } from '../ui/MultilineInput';
import { NoteCategory } from '../types';

/**
 * Add a note to the recording
 */
export async function addNote(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress. Start recording first.');
    return;
  }

  const content = await showMultilineInput({
    title: '📝 Add Note',
    placeholder: 'Add any notes about what you\'re doing, decisions made, or tips for replication...',
    saveLabel: 'Add Note',
  });

  if (!content) {
    return;
  }

  // Ask for category
  const categoryChoice = await vscode.window.showQuickPick(
    [
      { label: '💡 Explanation', value: 'explanation' as NoteCategory },
      { label: '✨ Tip', value: 'tip' as NoteCategory },
      { label: '⚠️ Warning', value: 'warning' as NoteCategory },
      { label: '🤔 Decision', value: 'decision' as NoteCategory },
      { label: '📋 Todo', value: 'todo' as NoteCategory },
    ],
    { placeHolder: 'What kind of note is this? (optional)' }
  );

  session.addNote(content, categoryChoice?.value);
  
  const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
  vscode.window.showInformationMessage(`📝 Note added: "${preview}"`);
}
