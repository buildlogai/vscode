import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';
import { showMultilineInput } from '../ui/MultilineInput';

/**
 * Add an AI prompt to the recording
 * 
 * Prompts are the PRIMARY ARTIFACT in buildlog v2.
 * The workflow is replicable because others can replay these prompts.
 */
export async function addPrompt(session: RecordingSession): Promise<void> {
  if (!session.isRecording()) {
    vscode.window.showWarningMessage('No recording in progress. Start recording first.');
    return;
  }

  const content = await showMultilineInput({
    title: '💬 Add AI Prompt',
    placeholder: 'Paste the prompt you sent to the AI...\n\nThis is the primary artifact that makes your workflow replicable.',
    saveLabel: 'Add Prompt',
  });

  if (!content) {
    return;
  }

  // Optionally get active file as context
  const activeEditor = vscode.window.activeTextEditor;
  const context = activeEditor 
    ? [vscode.workspace.asRelativePath(activeEditor.document.uri)] 
    : undefined;

  session.addPrompt(content, { context });
  
  const promptCount = session.getPromptCount();
  const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
  vscode.window.showInformationMessage(`💬 Prompt #${promptCount} added: "${preview}"`);
}
