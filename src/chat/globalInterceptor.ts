import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';

/**
 * Global Chat Interceptor
 * 
 * Listens to ALL Copilot Chat activity (not just @buildlog) and automatically
 * captures prompts and responses when recording is active.
 * 
 * This is the "it just works" mode - no need to use @buildlog prefix.
 */
export function registerGlobalChatInterceptor(
  context: vscode.ExtensionContext,
  getSession: () => RecordingSession | undefined
) {
  console.log('[Buildlog] 🎧 Registering global chat interceptor...');

  // Track the last chat request so we can capture responses
  let lastChatRequest: {
    prompt: string;
    timestamp: number;
  } | undefined;

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
