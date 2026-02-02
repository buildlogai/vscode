# Testing Buildlog Recording

## Quick Start

1. **Start Recording**
   ```
   Cmd+Shift+P → "Buildlog: Start Recording"
   ```
   
   You should see: `🔴 Recording started. Agent feed: ~/.buildlog/agent-feed.jsonl`

2. **Check the Console Output**
   ```
   View → Output → Select "Buildlog Recorder" from dropdown
   ```
   
   You should see:
   ```
   [Buildlog] 🔄 State changed: recording
   [Buildlog] 🎬 Starting agent feed watcher...
   ```

3. **Capture Some Prompts**
   
   In Copilot Chat, type:
   ```
   @buildlog Create a greeting function
   ```
   
   Look for:
   ```
   [Buildlog Chat] 📥 Capturing prompt: Create a greeting function...
   [Buildlog] ✅ Added PROMPT (#0): Create a greeting function
   [Buildlog] ✅ Step #0 added: PROMPT - Create a greeting function
   [Buildlog Chat] 📤 Capturing response (543 chars)
   [Buildlog] ✅ Added ACTION (#1): Created greeting function
   ```

4. **Check Status**
   ```
   Cmd+Shift+P → "Buildlog: Show Recording Status"
   ```
   
   Should show:
   ```
   🔴 Recording in progress
   
   Steps captured: 2
     • Prompts: 1
     • Actions: 1
     • Notes: 0
   
   ✅ This buildlog is replicable (has prompts)
   ```

5. **Stop Recording**
   ```
   Cmd+Shift+P → "Buildlog: Stop Recording"
   ```
   
   Check `.buildlog/` folder for the generated file.

## If Nothing is Being Captured

### 1. Verify Recording is Active
```
Cmd+Shift+P → "Buildlog: Show Recording Status"
```

If you see "Not recording", start recording first.

### 2. Check Console Logs
Open: `View → Output → Buildlog Recorder`

Look for warnings:
- `⚠️ Skipped prompt - not recording` → Start recording first
- `⚠️ No response to capture (empty)` → Response was empty
- No logs at all → Extension may not be activated

### 3. Verify Chat Participant
- Are you using `@buildlog` prefix in Copilot Chat?
- Is GitHub Copilot installed and active?
- Try the command without `@buildlog` first to verify Copilot works

### 4. Test Manual Capture
While recording, try:
```
Cmd+Shift+1 → Add a prompt manually
Cmd+Shift+2 → Add an action manually
```

If these work but chat doesn't, the issue is with chat participant integration.

## Running Tests

### Quick Unit Tests
```bash
cd vscode
npm run build
npm run test:unit
```

This tests the core RecordingSession logic without VS Code.

### Full Integration Tests
```bash
npm test
```

This downloads VS Code and runs the full test suite.

## Understanding the Logs

### When Everything Works
```
[Buildlog] 🔄 State changed: recording          ← Good: Recording started
[Buildlog] 🎬 Starting agent feed watcher...    ← Good: Agent feed active
[Buildlog Chat] 📥 Capturing prompt: ...        ← Good: Prompt captured
[Buildlog] ✅ Added PROMPT (#0): ...            ← Good: Step recorded
[Buildlog Chat] 📤 Capturing response ...       ← Good: Response captured
[Buildlog Chat] Files detected: app.js          ← Good: Files extracted
[Buildlog] ✅ Added ACTION (#1): ...            ← Good: Action recorded
```

### When Recording Isn't Started
```
[Buildlog Chat] ⚠️ Skipped prompt capture - not recording
[Buildlog] ⚠️ Skipped prompt - not recording
```

→ Run "Buildlog: Start Recording"

### When Extension Isn't Activated
```
(no logs in output panel)
```

→ Check "Buildlog Recorder" appears in Output dropdown
→ Try reloading VS Code window

## Debugging Agent Feed

If using skills.sh or other agents:

1. **Check feed file exists**
   ```bash
   cat ~/.buildlog/agent-feed.jsonl
   ```
   
   Should contain JSONL entries like:
   ```json
   {"type":"prompt","content":"Create a button"}
   {"type":"action","summary":"Created Button.tsx"}
   ```

2. **Watch for processing**
   Console should show:
   ```
   [Agent Feed] 📡 Processing entry: prompt
   [Buildlog] ✅ Added PROMPT (#0): ...
   ```

3. **Test manually**
   While recording:
   ```bash
   echo '{"type":"prompt","content":"Test prompt"}' >> ~/.buildlog/agent-feed.jsonl
   ```
   
   Should appear in console logs within 500ms.

## Expected Behavior

### Recording Session
- Starts: State changes to "recording", status bar updates, agent feed watcher starts
- Active: All @buildlog prompts captured, responses analyzed for files
- Stops: Buildlog file saved to `.buildlog/`, stats shown

### Step Capture
- **Prompts**: Captured from @buildlog chat, manual commands, agent feed
- **Actions**: Extracted from @buildlog responses, manual commands, agent feed
- **Notes**: Manual commands only (Cmd+Shift+N)

### Replicability
- **Replicable**: Has at least 1 prompt → Status "success"
- **Not Replicable**: No prompts → Status "abandoned"

## Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Skipped prompt - not recording" | Recording not started | Start recording first |
| No logs in Output panel | Extension not activated | Reload window, check extension installed |
| @buildlog not recognized | Chat participant not registered | Restart VS Code |
| Empty buildlog file | No steps captured | Check console for why steps were skipped |
| "Not recording" status | Recording was stopped | Start a new recording |

## Next Steps

1. Start a recording
2. Open Output panel
3. Use @buildlog in chat
4. Watch the console logs
5. Check status command
6. Stop and inspect .buildlog file

The verbose logging should now make it obvious what's happening at every step.
