# Buildlog Recorder Tests

## Running Tests

### Unit Tests (No VS Code Required)
```bash
npm run test:unit
```

These tests verify the core recording logic without needing a VS Code instance.

### Integration Tests (Requires VS Code)
```bash
npm test
```

This downloads VS Code and runs the full extension test suite.

## Test Coverage

### Recording Session Tests (`recording.test.ts`)

The test suite covers:

1. **Basic Recording Flow**
   - Starting and stopping recordings
   - State management (idle → recording → idle)

2. **Step Capture**
   - Prompt steps with context and intent
   - Action steps with file tracking
   - Note steps with categories
   - Checkpoint steps
   - Error steps (resolved and unresolved)
   - Terminal steps (success and failure)

3. **Metadata & Outcome**
   - Proper metadata generation (ID, timestamps, duration)
   - File tracking (created, modified counts)
   - Replicability detection (prompts = replicable)
   - Outcome status (success, abandoned)

4. **Workflow Simulation**
   - Full end-to-end workflow simulation
   - Typical AI-assisted coding session
   - Multiple steps with proper sequencing

## Debugging Recording Issues

If recordings aren't capturing steps, check the Output panel (View → Output → Buildlog Recorder):

```
[Buildlog] 🔄 State changed: recording
[Buildlog] 🎬 Starting agent feed watcher...
[Buildlog Chat] 📥 Capturing prompt: Create a button component...
[Buildlog] ✅ Added PROMPT (#0): Create a button component
[Buildlog Chat] 📤 Capturing response (1234 chars)
[Buildlog] ✅ Added ACTION (#1): Created Button.tsx with TypeScript...
```

Look for these log patterns:
- `✅ Added PROMPT/ACTION/NOTE` - Steps are being captured
- `⚠️ Skipped prompt - not recording` - Recording not active
- `📡 Processing entry: prompt/action` - Agent feed entries detected
- `Files detected: app.js, utils.js` - File tracking working

## Common Issues

### No Steps Captured
- **Check**: Is recording actually started? Look for "🔴 Recording started" message
- **Check**: Are you using `@buildlog` in Copilot Chat?
- **Check**: Console logs showing "not recording" warnings?

### Agent Feed Not Working
- **Check**: File exists at `~/.buildlog/agent-feed.jsonl`
- **Check**: Skills.sh or other agents writing to feed file
- **Check**: Logs showing "Processing entry" messages

### Chat Participant Not Capturing
- **Check**: GitHub Copilot is installed and active
- **Check**: Using `@buildlog` prefix in chat
- **Check**: Console shows "Capturing prompt/response" messages

## Test Development

When adding new features:

1. Add a test case to `recording.test.ts`
2. Run `npm run test:unit` to verify
3. Test manually in extension development host
4. Check console logs for verbose output
