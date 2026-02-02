import * as vscode from 'vscode';
import { RecordingSession } from '../recorder';

/**
 * Buildlog Chat Participant
 * 
 * Users invoke @buildlog in Copilot Chat to have their prompts
 * and responses automatically recorded to the current session.
 * 
 * The participant forwards requests to the underlying model and
 * captures the conversation for the buildlog.
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  getSession: () => RecordingSession | undefined
) {
  const participant = vscode.chat.createChatParticipant('buildlog.recorder', async (request, chatContext, stream, token) => {
    const session = getSession();
    
    // Check if we're recording
    if (!session || session.getState() !== 'recording') {
      stream.markdown('⚠️ **Not recording.** Start a recording first with the command `Buildlog: Start Recording`, then use `@buildlog` to capture your prompts.\n\n');
      stream.markdown('---\n\n');
      // Still forward to model so user gets a response
    }

    const prompt = request.prompt;
    const command = request.command;
    
    // Build the display for what we're recording
    const fullPrompt = command ? `/${command} ${prompt}` : prompt;
    
    // Record the prompt if session is active
    if (session?.getState() === 'recording') {
      console.log(`[Buildlog Chat] 📥 Capturing prompt: ${fullPrompt.substring(0, 60)}...`);
      session.addPrompt(fullPrompt, {
        context: extractReferences(request),
        intent: command,
      });
      stream.markdown(`📝 *Recorded prompt to buildlog*\n\n---\n\n`);
    } else {
      console.log(`[Buildlog Chat] ⚠️  Skipped prompt capture - not recording`);
    }

    // Forward to the model
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
      
      if (models.length === 0) {
        stream.markdown('❌ No Copilot model available. Make sure GitHub Copilot is installed and active.');
        return;
      }

      const model = models[0];
      
      // Build message history from chat context
      const messages: vscode.LanguageModelChatMessage[] = [];
      
      // Add previous turns
      for (const turn of chatContext.history) {
        if (turn instanceof vscode.ChatRequestTurn) {
          messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
        } else if (turn instanceof vscode.ChatResponseTurn) {
          const responseText = turn.response
            .filter((part): part is vscode.ChatResponseMarkdownPart => part instanceof vscode.ChatResponseMarkdownPart)
            .map(part => part.value.value)
            .join('');
          if (responseText) {
            messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
          }
        }
      }
      
      // Add current prompt
      messages.push(vscode.LanguageModelChatMessage.User(prompt));

      // Make request
      const response = await model.sendRequest(messages, {}, token);
      
      // Stream and collect response
      let fullResponse = '';
      for await (const fragment of response.text) {
        stream.markdown(fragment);
        fullResponse += fragment;
      }

      // Record the action/response if session is active
      if (session?.getState() === 'recording' && fullResponse) {
        console.log(`[Buildlog Chat] 📤 Capturing response (${fullResponse.length} chars)`);
        // Extract any file mentions from the response
        const filesModified = extractFilePaths(fullResponse);
        
        // Create a summary (first 200 chars or first paragraph)
        const summary = createSummary(fullResponse);
        
        console.log(`[Buildlog Chat] Files detected: ${filesModified.length > 0 ? filesModified.join(', ') : 'none'}`);
        session.addAction(summary, {
          filesModified: filesModified.length > 0 ? filesModified : undefined,
          approach: fullResponse.length > 500 ? 'See chat response for details' : undefined,
        });
      } else if (session?.getState() === 'recording') {
        console.log(`[Buildlog Chat] ⚠️  No response to capture (empty)`);
      }

    } catch (err) {
      if (err instanceof vscode.LanguageModelError) {
        stream.markdown(`\n\n❌ Model error: ${err.message}`);
      } else {
        stream.markdown(`\n\n❌ Error: ${(err as Error).message}`);
      }
    }
  });

  participant.iconPath = vscode.Uri.file('assets/buildlog-beaver-sm.png');

  context.subscriptions.push(participant);
  return participant;
}

/**
 * Extract file references from the request
 */
function extractReferences(request: vscode.ChatRequest): string[] {
  const refs: string[] = [];
  
  // request.references contains file/symbol references the user included
  for (const ref of request.references) {
    if (ref.value && typeof ref.value === 'object' && 'uri' in ref.value) {
      const uri = (ref.value as any).uri;
      if (uri && typeof uri === 'object' && 'fsPath' in uri) {
        refs.push(vscode.workspace.asRelativePath(uri as vscode.Uri));
      }
    } else if (typeof ref.value === 'string') {
      refs.push(ref.value);
    }
  }
  
  return refs;
}

/**
 * Extract file paths from response text
 */
function extractFilePaths(text: string): string[] {
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
