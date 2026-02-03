import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The copilot instructions content that tells AI agents how to log to buildlog
 */
const COPILOT_INSTRUCTIONS = `# Copilot Instructions for Buildlog

## MANDATORY: Log Every Response

You MUST run this at the END of EVERY response where you make changes:

\`\`\`bash
echo '{"type":"prompt","raw":"<EXACT user prompt text>","content":"<short title>"}' >> ~/.buildlog/agent-feed.jsonl
echo '{"type":"action","summary":"<what you did>","filesModified":["file1.ts"]}' >> ~/.buildlog/agent-feed.jsonl
\`\`\`

**DO NOT SKIP THIS.** The buildlog extension watches this file to record the session.

## Quick Reference

- \`type: "prompt"\` - Log the user's request
  - \`raw\`: **REQUIRED** - The exact, complete user prompt (up to 2000 chars)
  - \`content\`: A short title/summary (3-10 words) for display
- \`type: "action"\` - Log what you did (include \`filesModified\` array)
- \`type: "note"\` - Optional observations or decisions

## Example

User: "Add a login button to the header component. It should use our existing auth context and redirect to /dashboard after login."

After making changes, run:
\`\`\`bash
echo '{"type":"prompt","raw":"Add a login button to the header component. It should use our existing auth context and redirect to /dashboard after login.","content":"Add login button to header"}' >> ~/.buildlog/agent-feed.jsonl
echo '{"type":"action","summary":"Added LoginButton component to Header with auth integration","filesModified":["components/Header.tsx","components/LoginButton.tsx"]}' >> ~/.buildlog/agent-feed.jsonl
\`\`\`

**Remember: Log at the END of your response, AFTER all code changes.**
`;

/**
 * Ensures the .github/copilot-instructions.md file exists in the workspace
 * This tells AI agents (like GitHub Copilot) how to log their activity
 */
export async function ensureCopilotInstructions(workspaceRoot: string): Promise<boolean> {
  const githubDir = path.join(workspaceRoot, '.github');
  const instructionsPath = path.join(githubDir, 'copilot-instructions.md');

  try {
    // Check if file already exists
    if (fs.existsSync(instructionsPath)) {
      const existingContent = fs.readFileSync(instructionsPath, 'utf-8');
      // Check if it already has buildlog instructions
      if (existingContent.includes('buildlog') || existingContent.includes('agent-feed.jsonl')) {
        console.log('[Buildlog] Copilot instructions already configured');
        return true;
      }
      
      // File exists but doesn't have buildlog instructions - append
      const updatedContent = existingContent + '\n\n' + COPILOT_INSTRUCTIONS;
      fs.writeFileSync(instructionsPath, updatedContent);
      console.log('[Buildlog] Appended buildlog instructions to existing copilot-instructions.md');
      return true;
    }

    // Create .github directory if it doesn't exist
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }

    // Create the instructions file
    fs.writeFileSync(instructionsPath, COPILOT_INSTRUCTIONS);
    console.log('[Buildlog] Created .github/copilot-instructions.md');
    
    vscode.window.showInformationMessage(
      'Buildlog: Created .github/copilot-instructions.md for AI agent integration'
    );
    
    return true;
  } catch (error) {
    console.error('[Buildlog] Failed to create copilot instructions:', error);
    return false;
  }
}

/**
 * Get the instructions content (for display or other uses)
 */
export function getCopilotInstructionsContent(): string {
  return COPILOT_INSTRUCTIONS;
}
