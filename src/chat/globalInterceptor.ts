import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';

/**
 * Global Chat Interceptor
 * 
 * NOTE: As of VS Code 1.85+, there is no public API to intercept Copilot Chat
 * prompts automatically. The vscode.lm API only provides:
 * - selectChatModels() - to request access to models
 * - sendRequest() - to send requests FROM extensions
 * - onDidChangeChatModels - when available models change
 * 
 * There are NO events for intercepting user prompts to Copilot.
 * 
 * Workarounds for prompt capture:
 * 1. Use @buildlog prefix in chat (triggers our chat participant)
 * 2. Manually add prompts via "Buildlog: Add Prompt" command
 * 3. Have AI agents write to ~/.buildlog/agent-feed.jsonl
 */
export function registerGlobalChatInterceptor(
  context: vscode.ExtensionContext,
  getSession: () => RecordingSession | undefined
) {
  console.log('[Buildlog] 🎧 Global chat interceptor: checking API availability...');

  // Check if the lm API exists
  if (!vscode.lm) {
    console.log('[Buildlog] ⚠️ vscode.lm API not available');
    return;
  }

  // Check for the specific event APIs (these don't exist in public API as of VS Code 1.95)
  const lmAny = vscode.lm as any;
  if (!lmAny.onDidSendChatModelRequest) {
    console.log('[Buildlog] ℹ️ No automatic prompt interception available (expected)');
    console.log('[Buildlog] 💡 To capture prompts, use one of:');
    console.log('[Buildlog]    • @buildlog prefix in Copilot Chat');
    console.log('[Buildlog]    • "Buildlog: Add Prompt" command (Cmd+Shift+P)');
    console.log('[Buildlog]    • Agent feed: ~/.buildlog/agent-feed.jsonl');
    return;
  }

  // If we somehow have the events (future VS Code version?), use them
  console.log('[Buildlog] ✨ Prompt interception API available! Registering...');

  // Track the last chat request so we can capture responses
  let lastChatRequest: {
    prompt: string;
    timestamp: number;
  } | undefined;

  try {
    // Listen to chat model requests
    const requestListener = vscode.lm.onDidSendChatModelRequest((event) => {
    const session = getSession();
    if (!session || session.getState() !== 'recording') {
      return;
    }

    // Extract the user's prompt from the messages
    const messages = event.request.messages;
    const userMessages = messages.filter(m => m.role === vscode.LanguageModelChatMessageRole.User);
    
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1];
      const prompt = typeof lastUserMessage.content === 'string' 
        ? lastUserMessage.content 
        : lastUserMessage.content.map(c => c.value).join('\n');

      console.log(`[Buildlog Global] 📥 Intercepted chat prompt: ${prompt.substring(0, 60)}...`);
      
      // Capture the prompt
      session.addPrompt(prompt, {
        context: extractFilesFromContext(event),
      });

      // Store for response capture
      lastChatRequest = {
        prompt,
        timestamp: Date.now(),
      };
    }
  });

  // Listen to chat model responses
  const responseListener = vscode.lm.onDidReceiveChatModelResponse((event) => {
    const session = getSession();
    if (!session || session.getState() !== 'recording') {
      return;
    }

    if (!lastChatRequest || Date.now() - lastChatRequest.timestamp > 30000) {
      // Skip if no recent request or too old (30s timeout)
      return;
    }

    // Collect the response text
    const responseText = event.response.text || '';
    
    if (responseText.length === 0) {
      console.log(`[Buildlog Global] ⚠️  No response text to capture`);
      return;
    }

    console.log(`[Buildlog Global] 📤 Captured response (${responseText.length} chars)`);

    // Extract file mentions from the response
    const filesModified = extractFileMentions(responseText);
    
    // Create a summary (first 200 chars or first paragraph)
    const summary = createSummary(responseText);
    
    if (filesModified.length > 0) {
      console.log(`[Buildlog Global] Files detected: ${filesModified.join(', ')}`);
    }

    session.addAction(summary, {
      filesModified: filesModified.length > 0 ? filesModified : undefined,
      approach: responseText.length > 500 ? 'See chat response for details' : undefined,
    });

    // Clear the last request
    lastChatRequest = undefined;
  });

    context.subscriptions.push(requestListener, responseListener);
    console.log('[Buildlog] ✅ Global chat interceptor registered');
  } catch (error) {
    console.log('[Buildlog] ⚠️ Failed to register global chat interceptor:', error);
    console.log('[Buildlog] 💡 Use @buildlog prefix or manual prompt entry instead');
  }
}

/**
 * Extract file paths from context
 */
function extractFilesFromContext(event: any): string[] | undefined {
  // Try to extract file references from the request context
  // This is best-effort based on available context
  return undefined;
}

/**
 * Extract file mentions from response text
 */
function extractFileMentions(text: string): string[] {
  const files = new Set<string>();
  
  // Match file paths like: src/file.ts, app.js, etc.
  const pathRegex = /\b[\w-]+\/[\w-/.]+\.\w+\b/g;
  const matches = text.match(pathRegex);
  if (matches) {
    matches.forEach(m => files.add(m));
  }
  
  // Match single files like: file.ts, app.js
  const fileRegex = /\b[\w-]+\.\w{2,4}\b/g;
  const fileMatches = text.match(fileRegex);
  if (fileMatches) {
    fileMatches.forEach(m => {
      // Filter out common false positives
      if (!m.match(/\.(com|org|net|io|dev)$/)) {
        files.add(m);
      }
    });
  }
  
  return Array.from(files);
}

/**
 * Create a summary from response text
 */
function createSummary(text: string): string {
  // Get first paragraph or first 200 chars
  const firstPara = text.split('\n\n')[0];
  if (firstPara.length <= 200) {
    return firstPara;
  }
  return text.substring(0, 200).trim() + '...';
}
