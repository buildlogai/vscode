/**
 * Simple standalone test to prove recording logic works
 * Run with: node test/simple.test.js
 */

const assert = require('assert');

// Mock vscode module
global.vscode = {
  EventEmitter: class EventEmitter {
    constructor() {
      this.listeners = [];
    }
    fire(data) {
      this.listeners.forEach(fn => fn(data));
    }
    event(fn) {
      this.listeners.push(fn);
      return { dispose: () => {} };
    }
    dispose() {}
  },
  Disposable: class Disposable {
    constructor(dispose) {
      this.disposeFn = dispose;
    }
    dispose() {
      if (this.disposeFn) this.disposeFn();
    }
  }
};

// Now load the RecordingSession
const path = require('path');
const RecordingSession = require('../dist/extension.js').RecordingSession || 
  require(path.join(__dirname, '../out/test/src/recorder/RecordingSession.js')).RecordingSession;

console.log('🧪 Testing Buildlog Recording Logic...\n');

async function runTests() {
  let passCount = 0;
  let failCount = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passCount++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}`);
      failCount++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passCount++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}`);
      failCount++;
    }
  }

  // Test 1: Can create session
  test('Can create recording session', () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    assert.ok(session);
    session.dispose();
  });

  // Test 2: Recording starts in idle state
  test('Recording starts in idle state', () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    assert.strictEqual(session.getState(), 'idle');
    session.dispose();
  });

  // Test 3: Can start recording
  await asyncTest('Can start recording', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    await session.start('Test Recording');
    assert.strictEqual(session.getState(), 'recording');
    assert.strictEqual(session.isRecording(), true);
    session.dispose();
  });

  // Test 4: Can capture prompt
  await asyncTest('Can capture prompt steps', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    
    let stepCaptured = false;
    session.onStep(() => { stepCaptured = true; });
    
    await session.start('Prompt Test');
    session.addPrompt('Create a hello world function');
    
    const buildlog = await session.stop();
    
    assert.strictEqual(buildlog.steps.length, 1);
    assert.strictEqual(buildlog.steps[0].type, 'prompt');
    assert.strictEqual(buildlog.steps[0].content, 'Create a hello world function');
    assert.strictEqual(stepCaptured, true);
    
    session.dispose();
  });

  // Test 5: Can capture action with files
  await asyncTest('Can capture action steps with file tracking', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    
    await session.start('Action Test');
    session.addAction('Created hello.js', {
      filesCreated: ['hello.js']
    });
    session.addAction('Modified app.js', {
      filesModified: ['app.js', 'index.js']
    });
    
    const buildlog = await session.stop();
    
    assert.strictEqual(buildlog.steps.length, 2);
    assert.strictEqual(buildlog.steps[0].type, 'action');
    assert.strictEqual(buildlog.steps[0].summary, 'Created hello.js');
    assert.deepStrictEqual(buildlog.steps[0].filesCreated, ['hello.js']);
    assert.strictEqual(buildlog.outcome.filesCreated, 1);
    assert.strictEqual(buildlog.outcome.filesModified, 2);
    
    session.dispose();
  });

  // Test 6: Replicability detection
  await asyncTest('Marks buildlog as replicable when prompts exist', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    
    await session.start('Replicable Test');
    session.addPrompt('Build a counter');
    session.addAction('Created Counter.tsx');
    
    const buildlog = await session.stop();
    
    assert.strictEqual(buildlog.metadata.replicable, true);
    assert.strictEqual(buildlog.outcome.canReplicate, true);
    assert.strictEqual(buildlog.outcome.status, 'success');
    
    session.dispose();
  });

  // Test 7: Non-replicable without prompts
  await asyncTest('Marks buildlog as non-replicable without prompts', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    
    await session.start('Non-replicable Test');
    session.addAction('Manual edit');
    session.addNote('Fixed a typo');
    
    const buildlog = await session.stop();
    
    assert.strictEqual(buildlog.metadata.replicable, false);
    assert.strictEqual(buildlog.outcome.canReplicate, false);
    assert.strictEqual(buildlog.outcome.status, 'abandoned');
    
    session.dispose();
  });

  // Test 8: Full workflow simulation
  await asyncTest('Full workflow simulation', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    
    await session.start('Email Client Demo');
    
    // Simulate building the email client
    session.addPrompt('Create an email client interface');
    session.addAction('Created email list component', {
      filesCreated: ['app.js']
    });
    
    session.addPrompt('Add more realistic email content');
    session.addAction('Expanded email preview text', {
      filesModified: ['app.js']
    });
    
    session.addNote('User wants email bodies to be more detailed', 'decision');
    
    const buildlog = await session.stop();
    
    assert.strictEqual(buildlog.steps.length, 5);
    assert.strictEqual(buildlog.metadata.replicable, true);
    assert.strictEqual(buildlog.outcome.status, 'success');
    assert.strictEqual(buildlog.outcome.filesCreated, 1);
    assert.strictEqual(buildlog.outcome.filesModified, 1);
    
    // Verify step sequence
    assert.strictEqual(buildlog.steps[0].sequence, 0);
    assert.strictEqual(buildlog.steps[1].sequence, 1);
    assert.strictEqual(buildlog.steps[2].sequence, 2);
    assert.strictEqual(buildlog.steps[3].sequence, 3);
    assert.strictEqual(buildlog.steps[4].sequence, 4);
    
    session.dispose();
  });

  // Test 9: Steps not captured when not recording
  await asyncTest('Steps not captured when not recording', async () => {
    const session = new RecordingSession({
      workspaceRoot: '/tmp/test',
      workspaceName: 'test'
    });
    
    // Try to add steps without starting recording
    session.addPrompt('This should be ignored');
    session.addAction('This should be ignored');
    
    // Now start recording
    await session.start('Test');
    const buildlog = await session.stop();
    
    // Should have 0 steps since we added them before recording started
    assert.strictEqual(buildlog.steps.length, 0);
    assert.strictEqual(buildlog.outcome.status, 'abandoned');
    
    session.dispose();
  });

  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`\nTotal: ${passCount + failCount} tests\n`);
  
  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! Recording logic is working correctly.\n');
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
