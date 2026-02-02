# Verbose Logging & Test Suite

## Changes Made

### 1. Enhanced Console Logging

Added detailed logging throughout the recording flow to track what's happening:

#### Extension Lifecycle
- `🔄 State changed: recording/idle` - When recording state changes
- `🎬 Starting agent feed watcher...` - When agent feed starts monitoring
- `⏹️ Stopping agent feed watcher...` - When monitoring stops

#### Step Capture (RecordingSession)
- `✅ Added PROMPT (#0): Create a button component...` - When prompt captured
- `✅ Added ACTION (#1): Created Button.tsx [app.js]` - When action captured with files
- `📝 Added NOTE (#2): User wants dark mode...` - When note captured
- `⚠️ Skipped prompt - not recording` - When steps attempted while not recording

#### Chat Participant
- `📥 Capturing prompt: /fix Add error handling...` - When @buildlog captures prompt
- `📤 Capturing response (1234 chars)` - When response captured
- `Files detected: app.js, utils.js` - When files extracted from response
- `⚠️ No response to capture (empty)` - When response is empty

#### Agent Feed
- `📡 Processing entry: prompt/action` - When agent feed entry processed
- All agent entries logged as they're incorporated

#### Step Events
- `✅ Step #0 added: PROMPT - Create a button component...` - Global step tracker

### 2. Recording Status Command

New command: **Buildlog: Show Recording Status**

Shows real-time statistics:
```
🔴 Recording in progress

Steps captured: 7
  • Prompts: 3
  • Actions: 3
  • Notes: 1
  • Others: 0

Files: 2 modified, 1 created

✅ This buildlog is replicable (has prompts)
```

With actions to:
- View Output (opens console logs)
- Stop Recording

### 3. Comprehensive Test Suite

Created `test/recording.test.ts` with 13 test cases:

#### Basic Tests
- Start and stop recording
- State management
- Metadata generation

#### Step Capture Tests
- Prompt steps with context
- Action steps with file tracking
- Note steps with categories
- Checkpoint steps
- Error steps (resolved/unresolved)
- Terminal steps (success/failure)

#### Integration Tests
- Sequence number tracking
- Replicability detection
- File tracking in outcome
- Full workflow simulation

#### Edge Cases
- Steps not captured when not recording
- Empty buildlogs marked as non-replicable

### 4. Test Infrastructure

- `test/runTest.ts` - VS Code integration test runner
- `test/suite/index.ts` - Mocha test suite loader
- `test/README.md` - Documentation for running tests

### 5. NPM Scripts

```json
"test": "node ./out/test/runTest.js",          // Full VS Code integration tests
"test:unit": "tsc && node --test out/test/recording.test.js"  // Quick unit tests
```

## How to Debug Recording Issues

### Step 1: Check Console Output

1. Open Output panel: `View → Output`
2. Select "Buildlog Recorder" from dropdown
3. Start a recording
4. Look for these patterns:

```
[Buildlog] 🔄 State changed: recording           ← Recording started
[Buildlog] 🎬 Starting agent feed watcher...     ← Agent feed active
[Buildlog] ✅ Added PROMPT (#0): ...             ← Steps being captured
```

### Step 2: Use Status Command

Run `Buildlog: Show Recording Status` to see:
- How many steps have been captured
- Breakdown by type (prompts, actions, notes)
- File tracking stats
- Whether buildlog is replicable

### Step 3: Run Tests

```bash
cd vscode
npm run test:unit
```

This verifies the core recording logic works correctly.

## Common Log Patterns

### ✅ Everything Working
```
[Buildlog] 🔄 State changed: recording
[Buildlog] 🎬 Starting agent feed watcher...
[Buildlog Chat] 📥 Capturing prompt: Create a CTA button...
[Buildlog] ✅ Added PROMPT (#0): Create a CTA button...
[Buildlog] ✅ Step #0 added: PROMPT - Create a CTA button...
[Buildlog Chat] 📤 Capturing response (543 chars)
[Buildlog Chat] Files detected: app.js
[Buildlog] ✅ Added ACTION (#1): Created CTA function [app.js]
[Buildlog] ✅ Step #1 added: ACTION - Created CTA function...
```

### ⚠️ Not Recording
```
[Buildlog Chat] ⚠️ Skipped prompt capture - not recording
[Buildlog] ⚠️ Skipped prompt - not recording
```

→ Solution: Run "Buildlog: Start Recording" first

### 🔇 Silent (No Logs)
```
(no output)
```

→ Possible causes:
- Extension not activated
- Chat participant not being invoked
- Agent feed file not being written to

→ Solution: Check extension is installed and "Buildlog Recorder" appears in Output dropdown

## What to Look For

### Prompts Being Captured?
Look for: `✅ Added PROMPT` and `📥 Capturing prompt`

If missing:
- Using `@buildlog` in Copilot Chat?
- Recording actually started?
- GitHub Copilot installed and active?

### Actions Being Captured?
Look for: `✅ Added ACTION` and `📤 Capturing response`

If missing:
- Are responses being generated?
- Check if "Files detected" shows any files
- Chat participant may not be extracting files correctly

### Agent Feed Working?
Look for: `📡 Processing entry: prompt`

If missing:
- Check `~/.buildlog/agent-feed.jsonl` exists
- Verify agents are writing to the file
- Check file permissions

## Next Steps

1. Start a recording and check console logs
2. Try capturing some steps via @buildlog in chat
3. Run status command to verify counts
4. Stop recording and check the .buildlog file
5. Run tests to ensure everything works

The verbose logging should now make it crystal clear what's happening (or not happening) during recording.
