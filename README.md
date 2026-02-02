# Buildlog - Record Your Builds

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/buildlog.buildlog-recorder)](https://marketplace.visualstudio.com/items?itemName=buildlog.buildlog-recorder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Capture AI-assisted coding sessions and export them as `.buildlog` files. Document your development process, track file changes, and record AI prompts and responses for sharing, learning, or documentation.

![Buildlog Recording Demo](assets/demo.gif)

## Features

- 🔴 **Session Recording** — Start/stop recording with a single keystroke
- 📁 **File Change Tracking** — Automatically captures file diffs as you code
- 💬 **AI Prompt/Response Logging** — Manually capture AI interactions
- 📝 **Notes** — Add contextual notes during your session
- ⏱️ **Timer** — Status bar shows elapsed recording time
- 📦 **Export** — Save sessions as `.buildlog` files

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Buildlog"
4. Click Install

### From VSIX

```bash
code --install-extension buildlog-recorder-0.1.0.vsix
```

## Usage

### Quick Start

1. Open a project folder in VS Code
2. Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to start recording
3. Code as usual — file changes are automatically captured
4. Use `Ctrl+Shift+1` to log AI prompts
5. Use `Ctrl+Shift+2` to log AI responses
6. Press `Ctrl+Shift+R` again to stop and save

### Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Buildlog: Start Recording` | `Ctrl+Shift+R` | Start a new recording session |
| `Buildlog: Stop Recording` | `Ctrl+Shift+R` | Stop recording and save |
| `Buildlog: Add AI Prompt` | `Ctrl+Shift+1` | Log an AI prompt |
| `Buildlog: Add AI Response` | `Ctrl+Shift+2` | Log an AI response |
| `Buildlog: Add Note` | `Ctrl+Shift+N` | Add a note |

### Status Bar

The status bar shows the current recording state:
- `○ Buildlog` — Not recording (click to start)
- `● REC 00:00` — Recording with elapsed time (click to stop)

## Output Format

Buildlog files are saved in the `.buildlog` directory of your workspace as JSON files with the `.buildlog` extension.

### File Structure

```json
{
  "version": "1.0.0",
  "metadata": {
    "id": "uuid",
    "title": "Session Title",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T11:45:00.000Z",
    "duration": 4500000,
    "workspaceName": "my-project",
    "filesChanged": 12,
    "totalEvents": 45
  },
  "events": [
    {
      "id": "uuid",
      "type": "file_change",
      "timestamp": "2024-01-15T10:35:00.000Z",
      "data": {
        "type": "file_change",
        "filePath": "src/index.ts",
        "changeType": "modify",
        "diff": "...",
        "linesAdded": 10,
        "linesRemoved": 3
      }
    },
    {
      "id": "uuid",
      "type": "prompt",
      "timestamp": "2024-01-15T10:36:00.000Z",
      "data": {
        "type": "prompt",
        "content": "How do I implement...",
        "model": "GPT-4"
      }
    }
  ],
  "snapshots": {
    "initial": [...],
    "final": [...]
  }
}
```

## Configuration

Configure Buildlog in VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `buildlog.outputDirectory` | `.buildlog` | Directory for saving buildlog files |
| `buildlog.apiKey` | `""` | API key for buildlog.dev uploads |

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/buildlog/vscode.git
cd vscode

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

### Testing

Press `F5` in VS Code to launch the Extension Development Host.

### Packaging

```bash
npm install -g @vscode/vsce
vsce package
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Buildlog](https://github.com/buildlog)

---

**Made with ❤️ by the Buildlog team**
