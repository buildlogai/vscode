import * as vscode from 'vscode';
import { RecordingSession } from './recorder';
import { StatusBar } from './ui';
import { registerChatParticipant, registerGlobalChatInterceptor } from './chat';
import { AgentFeedWatcher } from './agent';
import { FileChangeWatcher } from './watcher';
import { 
  startRecording, 
  stopRecording, 
  addPrompt, 
  addAction,
  addNote,
  showStatus 
} from './commands';

let session: RecordingSession | undefined;
let statusBar: StatusBar | undefined;
let agentFeedWatcher: AgentFeedWatcher | undefined;
let fileWatcher: FileChangeWatcher | undefined;

/**
 * Extension activation
 * 
 * Buildlog v2: Slim workflow recorder
 * Captures prompts (the artifact) and actions (what happened).
 * No more file watching or state snapshots.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('='.repeat(60));
  console.log('🎬 BUILDLOG EXTENSION ACTIVATED - v2.4.0');
  console.log('='.repeat(60));
  console.log('[Buildlog] Timestamp:', new Date().toISOString());

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

  // Create agent feed watcher (uses global ~/.buildlog/agent-feed.jsonl)
  agentFeedWatcher = new AgentFeedWatcher(() => session);

  // Create file change watcher for automatic capture
  fileWatcher = new FileChangeWatcher(() => session);

  // Update context for keybinding conditions and start/stop agent feed
  session.onStateChange(async (state) => {
    console.log('========== STATE CHANGE:', state, '==========');
    vscode.commands.executeCommand(
      'setContext', 
      'buildlog.isRecording', 
      state === 'recording'
    );
    
    // Start/stop agent feed watcher with recording
    if (state === 'recording' && agentFeedWatcher) {
      console.log('[Buildlog] 🎬 Starting agent feed watcher...');
      await agentFeedWatcher.start();
      // Message is shown in AgentFeedWatcher.start()
    } else if (state === 'idle' && agentFeedWatcher) {
      console.log('[Buildlog] ⏹️  Stopping agent feed watcher...');
      agentFeedWatcher.stop();
    }

    // Start/stop file watcher with recording
    if (state === 'recording' && fileWatcher) {
      console.log('>>>>>> STARTING FILE WATCHER <<<<<<');
      await fileWatcher.start();
      console.log('>>>>>> FILE WATCHER STARTED <<<<<<');
    } else if (state === 'idle' && fileWatcher) {
      console.log('>>>>>> STOPPING FILE WATCHER <<<<<<');
      fileWatcher.stop();
    }
  });

  // Track steps for logging
  session.onStep((step) => {
    const preview = step.type === 'prompt' 
      ? step.content?.substring(0, 50) 
      : step.type === 'action' 
      ? step.summary?.substring(0, 50)
      : step.type === 'note'
      ? step.content?.substring(0, 50)
      : '';
    console.log(`[Buildlog] ✅ Step #${step.sequence} added: ${step.type.toUpperCase()} - ${preview}${preview.length === 50 ? '...' : ''}`);
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
    vscode.commands.registerCommand('buildlog.showStatus', () => {
      if (session) {
        showStatus(session);
      }
    }),
  ];

  // Register chat participant for @buildlog prefix
  registerChatParticipant(context, () => session);

  // Register global chat interceptor to capture ALL Copilot Chat prompts
  registerGlobalChatInterceptor(context, () => session);

  // Add disposables to context
  context.subscriptions.push(
    session,
    statusBar,
    agentFeedWatcher,
    fileWatcher,
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
