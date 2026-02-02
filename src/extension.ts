import * as vscode from 'vscode';
import { RecordingSession } from './recorder';
import { StatusBar } from './ui';
import { 
  startRecording, 
  stopRecording, 
  addPrompt, 
  addAction,
  addNote 
} from './commands';

let session: RecordingSession | undefined;
let statusBar: StatusBar | undefined;

/**
 * Extension activation
 * 
 * Buildlog v2: Slim workflow recorder
 * Captures prompts (the artifact) and actions (what happened).
 * No more file watching or state snapshots.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Buildlog Recorder v2 is now active');

  // Get workspace info
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage(
      'Buildlog Recorder requires an open workspace folder.'
    );
    return;
  }

  // Create the recording session
  session = new RecordingSession({
    workspaceRoot: workspaceFolder.uri.fsPath,
    workspaceName: workspaceFolder.name,
  });

  // Create status bar
  statusBar = new StatusBar(session);

  // Update context for keybinding conditions
  session.onStateChange((state) => {
    vscode.commands.executeCommand(
      'setContext', 
      'buildlog.isRecording', 
      state === 'recording'
    );
  });

  // Track steps for logging
  session.onStep((step) => {
    console.log(`Buildlog step: ${step.type}`, step.id);
  });

  // Register commands
  const commands = [
    vscode.commands.registerCommand('buildlog.startRecording', () => {
      if (session) {
        startRecording(session);
      }
    }),
    vscode.commands.registerCommand('buildlog.stopRecording', () => {
      if (session) {
        stopRecording(session);
      }
    }),
    vscode.commands.registerCommand('buildlog.addPrompt', () => {
      if (session) {
        addPrompt(session);
      }
    }),
    vscode.commands.registerCommand('buildlog.addAction', () => {
      if (session) {
        addAction(session);
      }
    }),
    vscode.commands.registerCommand('buildlog.addNote', () => {
      if (session) {
        addNote(session);
      }
    }),
  ];

  // Add disposables to context
  context.subscriptions.push(
    session,
    statusBar,
    ...commands
  );

  // Set initial context
  vscode.commands.executeCommand('setContext', 'buildlog.isRecording', false);
}

/**
 * Extension deactivation
 */
export function deactivate() {
  // Stop any active recording
  if (session?.isRecording()) {
    session.stop().catch(console.error);
  }

  session?.dispose();
  statusBar?.dispose();
  
  session = undefined;
  statusBar = undefined;
}
