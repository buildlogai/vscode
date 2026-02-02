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
      session.addPrompt(fullPrompt, {
        context: extractReferences(request),
        intent: command,
      });
      stream.markdown(`📝 *Recorded prompt to buildlog*\n\n---\n\n`);
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
        // Extract any file mentions from the response
        const filesModified = extractFilePaths(fullResponse);
        
        // Create a summary (first 200 chars or first paragraph)
        const summary = createSummary(fullResponse);
        
        session.addAction(summary, {
          filesModified: filesModified.length > 0 ? filesModified : undefined,
          approach: fullResponse.length > 500 ? 'See chat response for details' : undefined,
        });
      }

    } catch (err) {
      if (err instanceof vscode.LanguageModelError) {
        stream.markdown(`\n\n❌ Model error: ${err.message}`);
        
        if (session?.getState() === 'recording') {
          session.addError(err.message, false);
        }
      } else {
        throw err;
      }
    }

    return;
  });

  // Set metadata
  participant.iconPath = new vscode.ThemeIcon('record');

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
    if ('uri' in ref.value && ref.value.uri) {
      refs.push(vscode.workspace.asRelativePath(ref.value.uri));
    } else if (typeof ref.value === 'string') {
      refs.push(ref.value);
    }
  }
  
  return refs;
}

/**
 * Extract file paths mentioned in the response
 */
function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  
  // Match common file path patterns
  const patterns = [
    /`([^`]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|css|html|json|yaml|yml|md|sql))`/gi,
    /(?:create|modify|update|edit|change)\s+(?:the\s+)?(?:file\s+)?[`"]?([^\s`"]+\.\w+)[`"]?/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const path = match[1];
      if (path && !paths.includes(path)) {
        paths.push(path);
      }
    }
  }
  
  return paths;
}

/**
 * Create a short summary of the response
 */
function createSummary(text: string): string {
  // Remove code blocks
  const withoutCode = text.replace(/```[\s\S]*?```/g, '[code block]');
  
  // Get first meaningful line
  const lines = withoutCode.split('\n').filter(l => l.trim().length > 0);
  const firstLine = lines[0] || 'AI response';
  
  // Truncate if needed
  if (firstLine.length > 200) {
    return firstLine.substring(0, 197) + '...';
  }
  
  return firstLine;
}
