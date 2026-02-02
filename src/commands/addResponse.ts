import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { showMultilineInput } from '../ui/MultilineInput';

/**
 * Add an AI response to the recording
 */
export async function addResponse(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress. Start recording first.');
    return;
  }

  const content = await showMultilineInput({
    title: 'Add AI Response',
    placeholder: 'Paste the AI response...',
    saveLabel: 'Add Response',
  });

  if (!content) {
    return;
  }

  // Optionally ask for the model used
  const model = await vscode.window.showInputBox({
    prompt: 'Which AI model was used? (optional)',
    placeHolder: 'e.g., GPT-4, Claude, Copilot',
  });

  session.addResponse(content, model || undefined);
  
  const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
  vscode.window.showInformationMessage(`🤖 Response added: "${preview}"`);
}
