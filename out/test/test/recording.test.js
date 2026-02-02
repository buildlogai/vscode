"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const RecordingSession_1 = require("../src/recorder/RecordingSession");
/**
 * Test suite for recording functionality
 * Ensures that steps are properly captured and buildlogs are generated correctly
 */
suite('Recording Session Tests', () => {
    let session;
    setup(() => {
        session = new RecordingSession_1.RecordingSession({
            workspaceRoot: path.join(os.tmpdir(), 'test-workspace'),
            workspaceName: 'test-workspace',
        });
    });
    teardown(() => {
        if (session) {
            session.dispose();
        }
    });
    test('Should start and stop recording', async () => {
        assert.strictEqual(session.getState(), 'idle');
        await session.start('Test Recording');
        assert.strictEqual(session.getState(), 'recording');
        assert.strictEqual(session.isRecording(), true);
        const buildlog = await session.stop();
        assert.strictEqual(session.getState(), 'idle');
        assert.strictEqual(buildlog.version, '2.0.0');
        assert.strictEqual(buildlog.metadata.title, 'Test Recording');
    });
    test('Should capture prompt steps', async () => {
        await session.start('Prompt Test');
        session.addPrompt('Create a hello world function');
        session.addPrompt('Add error handling', {
            context: ['main.js'],
            intent: 'fix',
        });
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 2);
        assert.strictEqual(buildlog.steps[0].type, 'prompt');
        assert.strictEqual(buildlog.steps[0].content, 'Create a hello world function');
        assert.strictEqual(buildlog.steps[1].type, 'prompt');
        assert.strictEqual(buildlog.steps[1].content, 'Add error handling');
        assert.deepStrictEqual(buildlog.steps[1].context, ['main.js']);
    });
    test('Should capture action steps with file tracking', async () => {
        await session.start('Action Test');
        session.addAction('Created hello world function', {
            filesCreated: ['hello.js'],
        });
        session.addAction('Fixed error handling', {
            filesModified: ['main.js', 'utils.js'],
        });
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 2);
        assert.strictEqual(buildlog.steps[0].type, 'action');
        assert.strictEqual(buildlog.steps[0].summary, 'Created hello world function');
        assert.deepStrictEqual(buildlog.steps[0].filesCreated, ['hello.js']);
        assert.strictEqual(buildlog.steps[1].type, 'action');
        assert.deepStrictEqual(buildlog.steps[1].filesModified, ['main.js', 'utils.js']);
        // Check outcome summary
        assert.strictEqual(buildlog.outcome.filesCreated, 1);
        assert.strictEqual(buildlog.outcome.filesModified, 2);
    });
    test('Should capture note steps', async () => {
        await session.start('Note Test');
        session.addNote('User wants dark mode');
        session.addNote('Performance tip needed', 'tip');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 2);
        assert.strictEqual(buildlog.steps[0].type, 'note');
        assert.strictEqual(buildlog.steps[0].content, 'User wants dark mode');
        assert.strictEqual(buildlog.steps[1].type, 'note');
        assert.strictEqual(buildlog.steps[1].category, 'tip');
    });
    test('Should track sequence numbers correctly', async () => {
        await session.start('Sequence Test');
        session.addPrompt('First prompt');
        session.addAction('First action');
        session.addNote('First note');
        session.addPrompt('Second prompt');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 4);
        assert.strictEqual(buildlog.steps[0].sequence, 0);
        assert.strictEqual(buildlog.steps[1].sequence, 1);
        assert.strictEqual(buildlog.steps[2].sequence, 2);
        assert.strictEqual(buildlog.steps[3].sequence, 3);
    });
    test('Should mark buildlog as replicable when prompts exist', async () => {
        await session.start('Replicable Test');
        session.addPrompt('Create a button component');
        session.addAction('Created Button.tsx');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.metadata.replicable, true);
        assert.strictEqual(buildlog.outcome.canReplicate, true);
        assert.strictEqual(buildlog.outcome.status, 'success');
    });
    test('Should mark buildlog as non-replicable without prompts', async () => {
        await session.start('Non-replicable Test');
        session.addAction('Manual file edit');
        session.addNote('Fixed typo');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.metadata.replicable, false);
        assert.strictEqual(buildlog.outcome.canReplicate, false);
        assert.strictEqual(buildlog.outcome.status, 'abandoned');
    });
    test('Should not capture steps when not recording', async () => {
        // Don't start recording
        session.addPrompt('This should be ignored');
        session.addAction('This should be ignored');
        await session.start('Test');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 0);
    });
    test('Should handle typical workflow simulation', async () => {
        await session.start('Full Workflow Simulation');
        // Simulate a typical AI-assisted workflow
        session.addPrompt('Create a React counter component');
        session.addAction('Created Counter.tsx with useState hook', {
            filesCreated: ['src/Counter.tsx'],
        });
        session.addPrompt('Add increment and decrement buttons');
        session.addAction('Added button controls and click handlers', {
            filesModified: ['src/Counter.tsx'],
        });
        session.addNote('User requested dark mode support', 'decision');
        session.addPrompt('Add dark mode styling');
        session.addAction('Added CSS classes for dark mode', {
            filesModified: ['src/Counter.tsx', 'src/styles.css'],
            filesCreated: ['src/styles.css'],
        });
        session.addCheckpoint('Component Complete', 'Counter component with dark mode support');
        const buildlog = await session.stop({
            status: 'success',
            summary: 'Built fully functional counter component with dark mode',
        });
        // Verify the workflow
        assert.strictEqual(buildlog.steps.length, 7);
        assert.strictEqual(buildlog.metadata.replicable, true);
        assert.strictEqual(buildlog.outcome.status, 'success');
        assert.strictEqual(buildlog.outcome.filesCreated, 2);
        assert.strictEqual(buildlog.outcome.filesModified, 2);
        // Check step types
        const stepTypes = buildlog.steps.map(s => s.type);
        assert.deepStrictEqual(stepTypes, [
            'prompt',
            'action',
            'prompt',
            'action',
            'note',
            'prompt',
            'action',
        ]);
    });
    test('Should include metadata fields', async () => {
        await session.start('Metadata Test');
        session.addPrompt('Test prompt');
        const buildlog = await session.stop();
        assert.ok(buildlog.metadata.id);
        assert.ok(buildlog.metadata.createdAt);
        assert.ok(buildlog.metadata.durationSeconds >= 0);
        assert.ok(buildlog.metadata.editor);
        assert.strictEqual(buildlog.format, 'slim');
    });
    test('Should handle checkpoint steps', async () => {
        await session.start('Checkpoint Test');
        session.addPrompt('Setup project');
        session.addCheckpoint('Initial Setup', 'Project structure created');
        session.addPrompt('Add features');
        session.addCheckpoint('Feature Complete', 'All features implemented');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 4);
        assert.strictEqual(buildlog.steps[1].type, 'checkpoint');
        assert.strictEqual(buildlog.steps[1].name, 'Initial Setup');
        assert.strictEqual(buildlog.steps[3].type, 'checkpoint');
    });
    test('Should handle error steps', async () => {
        await session.start('Error Test');
        session.addPrompt('Install dependencies');
        session.addError('npm install failed: ECONNREFUSED', false);
        session.addAction('Switched to offline registry');
        session.addError('npm install failed: ECONNREFUSED', true, 'Used npm cache');
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 4);
        assert.strictEqual(buildlog.steps[1].type, 'error');
        assert.strictEqual(buildlog.steps[1].resolved, false);
        assert.strictEqual(buildlog.steps[3].type, 'error');
        assert.strictEqual(buildlog.steps[3].resolved, true);
        assert.strictEqual(buildlog.steps[3].resolution, 'Used npm cache');
    });
    test('Should handle terminal steps', async () => {
        await session.start('Terminal Test');
        session.addPrompt('Run tests');
        session.addTerminal('npm test', 'success', {
            summary: 'All tests passed',
            exitCode: 0,
        });
        session.addTerminal('npm run build', 'failure', {
            summary: 'Build failed with type errors',
            exitCode: 1,
        });
        const buildlog = await session.stop();
        assert.strictEqual(buildlog.steps.length, 3);
        assert.strictEqual(buildlog.steps[1].type, 'terminal');
        assert.strictEqual(buildlog.steps[1].command, 'npm test');
        assert.strictEqual(buildlog.steps[1].outcome, 'success');
        assert.strictEqual(buildlog.steps[2].outcome, 'failure');
    });
});
