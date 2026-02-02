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
exports.RecordingSession = void 0;
const vscode = __importStar(require("vscode"));
const utils_1 = require("../utils");
const types_1 = require("../types");
/**
 * Manages a recording session (v2 - slim workflow format)
 *
 * Key change from v1: We no longer track file changes automatically.
 * Instead, users manually add steps representing their workflow.
 * The prompts are the artifact - code is ephemeral.
 */
class RecordingSession extends vscode.Disposable {
    constructor(options) {
        super(() => this.dispose());
        this.state = 'idle';
        this.title = '';
        this.steps = [];
        this.sequenceCounter = 0;
        // Track files for outcome summary
        this.filesCreated = new Set();
        this.filesModified = new Set();
        this._onStateChange = new vscode.EventEmitter();
        this.onStateChange = this._onStateChange.event;
        this._onStep = new vscode.EventEmitter();
        this.onStep = this._onStep.event;
        this.sessionId = (0, utils_1.v4)();
        this.workspaceRoot = options.workspaceRoot;
        this.workspaceName = options.workspaceName;
    }
    /**
     * Start a new recording session
     */
    async start(title) {
        if (this.state === 'recording') {
            throw new Error('Recording already in progress');
        }
        this.sessionId = (0, utils_1.v4)();
        this.title = title || `Workflow ${new Date().toLocaleDateString()}`;
        this.startTime = new Date();
        this.steps = [];
        this.sequenceCounter = 0;
        this.filesCreated.clear();
        this.filesModified.clear();
        this.setState('recording');
    }
    /**
     * Stop the recording and generate buildlog
     */
    async stop(outcome) {
        if (this.state !== 'recording') {
            throw new Error('No recording in progress');
        }
        const endTime = new Date();
        const durationSeconds = Math.round((endTime.getTime() - this.startTime.getTime()) / 1000);
        // Check if buildlog is replicable (has prompts)
        const hasPrompts = this.steps.some(s => s.type === 'prompt');
        const metadata = {
            id: this.sessionId,
            title: this.title,
            createdAt: this.startTime.toISOString(),
            durationSeconds,
            editor: (0, types_1.detectEditor)(),
            aiProvider: (0, types_1.detectAIProvider)(),
            replicable: hasPrompts,
        };
        const buildlogOutcome = {
            status: outcome?.status || (hasPrompts ? 'success' : 'abandoned'),
            summary: outcome?.summary || `Recorded ${this.steps.length} steps`,
            filesCreated: this.filesCreated.size,
            filesModified: this.filesModified.size,
            canReplicate: hasPrompts,
        };
        const buildlog = {
            version: types_1.BUILDLOG_VERSION,
            format: 'slim',
            metadata,
            steps: this.steps,
            outcome: buildlogOutcome,
        };
        this.setState('idle');
        this.reset();
        return buildlog;
    }
    /**
     * Add a prompt step (the primary artifact)
     */
    addPrompt(content, options) {
        if (this.state !== 'recording') {
            console.log('[Buildlog] ⚠️  Skipped prompt - not recording');
            return;
        }
        const step = {
            id: (0, utils_1.v4)(),
            type: 'prompt',
            timestamp: this.getTimestamp(),
            sequence: this.sequenceCounter++,
            content,
            context: options?.context,
            intent: options?.intent,
        };
        console.log(`[Buildlog] ✅ Added PROMPT (#${step.sequence}): ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`);
        this.addStep(step);
    }
    /**
     * Add an action step (what the AI did)
     */
    addAction(summary, options) {
        if (this.state !== 'recording') {
            console.log('[Buildlog] ⚠️  Skipped action - not recording');
            return;
        }
        // Track files for outcome
        options?.filesCreated?.forEach(f => this.filesCreated.add(f));
        options?.filesModified?.forEach(f => this.filesModified.add(f));
        const step = {
            id: (0, utils_1.v4)(),
            type: 'action',
            timestamp: this.getTimestamp(),
            sequence: this.sequenceCounter++,
            summary,
            filesCreated: options?.filesCreated,
            filesModified: options?.filesModified,
            filesDeleted: options?.filesDeleted,
            approach: options?.approach,
        };
        const filesInfo = options?.filesModified?.length ? ` [${options.filesModified.join(', ')}]` : '';
        console.log(`[Buildlog] ✅ Added ACTION (#${step.sequence}): ${summary}${filesInfo}`);
        this.addStep(step);
    }
    /**
     * Add a terminal step
     */
    addTerminal(command, outcome, options) {
        if (this.state !== 'recording')
            return;
        const step = {
            id: (0, utils_1.v4)(),
            type: 'terminal',
            timestamp: this.getTimestamp(),
            sequence: this.sequenceCounter++,
            command,
            outcome,
            summary: options?.summary,
            exitCode: options?.exitCode,
        };
        this.addStep(step);
    }
    /**
     * Add a note step
     */
    addNote(content, category) {
        if (this.state !== 'recording') {
            console.log('[Buildlog] ⚠️  Skipped note - not recording');
            return;
        }
        const step = {
            id: (0, utils_1.v4)(),
            type: 'note',
            timestamp: this.getTimestamp(),
            sequence: this.sequenceCounter++,
            content,
            category,
        };
        console.log(`[Buildlog] 📝 Added NOTE (#${step.sequence}): ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`);
        this.addStep(step);
    }
    /**
     * Add a checkpoint step
     */
    addCheckpoint(name, summary) {
        if (this.state !== 'recording')
            return;
        const step = {
            id: (0, utils_1.v4)(),
            type: 'checkpoint',
            timestamp: this.getTimestamp(),
            sequence: this.sequenceCounter++,
            name,
            summary,
        };
        this.addStep(step);
    }
    /**
     * Add an error step
     */
    addError(message, resolved = false, resolution) {
        if (this.state !== 'recording')
            return;
        const step = {
            id: (0, utils_1.v4)(),
            type: 'error',
            timestamp: this.getTimestamp(),
            sequence: this.sequenceCounter++,
            message,
            resolved,
            resolution,
        };
        this.addStep(step);
    }
    /**
     * Add a step to the recording
     */
    addStep(step) {
        this.steps.push(step);
        this._onStep.fire(step);
    }
    /**
     * Get timestamp in seconds since recording start
     */
    getTimestamp() {
        if (!this.startTime)
            return 0;
        return Math.round((Date.now() - this.startTime.getTime()) / 1000);
    }
    /**
     * Get the current recording state
     */
    getState() {
        return this.state;
    }
    /**
     * Get recording duration in milliseconds
     */
    getDuration() {
        if (!this.startTime)
            return 0;
        return Date.now() - this.startTime.getTime();
    }
    /**
     * Get the number of steps recorded
     */
    getStepCount() {
        return this.steps.length;
    }
    /**
     * Get the number of prompts recorded
     */
    getPromptCount() {
        return this.steps.filter(s => s.type === 'prompt').length;
    }
    /**
     * Get session title
     */
    getTitle() {
        return this.title;
    }
    /**
     * Set session title
     */
    setTitle(title) {
        this.title = title;
    }
    /**
     * Set the recording state
     */
    setState(state) {
        this.state = state;
        this._onStateChange.fire(state);
    }
    /**
     * Reset the session
     */
    reset() {
        this.steps = [];
        this.startTime = undefined;
        this.title = '';
        this.sequenceCounter = 0;
        this.filesCreated.clear();
        this.filesModified.clear();
    }
    /**
     * Check if currently recording
     */
    isRecording() {
        return this.state === 'recording';
    }
    /**
     * Get recording statistics
     */
    getStats() {
        const prompts = this.steps.filter(s => s.type === 'prompt').length;
        const actions = this.steps.filter(s => s.type === 'action').length;
        const notes = this.steps.filter(s => s.type === 'note').length;
        const others = this.steps.length - prompts - actions - notes;
        return {
            totalSteps: this.steps.length,
            prompts,
            actions,
            notes,
            others,
            filesCreated: this.filesCreated.size,
            filesModified: this.filesModified.size,
        };
    }
    dispose() {
        this._onStateChange.dispose();
        this._onStep.dispose();
    }
}
exports.RecordingSession = RecordingSession;
