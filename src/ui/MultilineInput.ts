import * as vscode from 'vscode';

export interface MultilineInputOptions {
  title: string;
  placeholder?: string;
  saveLabel?: string;
  initialValue?: string;
}

/**
 * Show a multiline input dialog using a webview panel
 */
export async function showMultilineInput(options: MultilineInputOptions): Promise<string | undefined> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'buildlogInput',
      options.title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    let resolved = false;

    const dispose = () => {
      if (!resolved) {
        resolved = true;
        resolve(undefined);
      }
      panel.dispose();
    };

    panel.onDidDispose(dispose);

    panel.webview.onDidReceiveMessage((message) => {
      resolved = true;
      if (message.type === 'save') {
        resolve(message.content);
      } else {
        resolve(undefined);
      }
      panel.dispose();
    });

    panel.webview.html = getWebviewContent(options);
  });
}

function getWebviewContent(options: MultilineInputOptions): string {
  const placeholder = options.placeholder || 'Enter text...';
  const saveLabel = options.saveLabel || 'Save';
  const initialValue = options.initialValue || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      margin: 0;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
    }
    textarea {
      flex: 1;
      width: 100%;
      min-height: 200px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      resize: none;
    }
    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    textarea::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
    }
    button {
      padding: 8px 16px;
      font-size: 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .hint {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <h2>${options.title}</h2>
  <textarea 
    id="content" 
    placeholder="${placeholder}"
    autofocus
  >${initialValue}</textarea>
  <p class="hint">Press Ctrl+Enter to save, Escape to cancel</p>
  <div class="buttons">
    <button class="secondary" onclick="cancel()">Cancel</button>
    <button class="primary" onclick="save()">${saveLabel}</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const textarea = document.getElementById('content');

    function save() {
      const content = textarea.value.trim();
      if (content) {
        vscode.postMessage({ type: 'save', content });
      }
    }

    function cancel() {
      vscode.postMessage({ type: 'cancel' });
    }

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    // Focus the textarea on load
    textarea.focus();
  </script>
</body>
</html>`;
}
