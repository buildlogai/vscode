"use strict";
/**
 * Buildlog Types - Local type definitions (v2.0.0)
 * Slim workflow format - prompts are the artifact
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEP_TYPE_ICONS = exports.BUILDLOG_VERSION = void 0;
exports.createEmptyBuildlog = createEmptyBuildlog;
exports.detectEditor = detectEditor;
exports.detectAIProvider = detectAIProvider;
// =============================================================================
// FORMAT & VERSION
// =============================================================================
exports.BUILDLOG_VERSION = '2.0.0';
// =============================================================================
// STEP ICONS & HELPERS
// =============================================================================
exports.STEP_TYPE_ICONS = {
    prompt: '💬',
    action: '⚡',
    terminal: '🖥️',
    note: '📝',
    checkpoint: '🚩',
    error: '❌',
};
function createEmptyBuildlog(metadata) {
    return {
        version: '2.0.0',
        format: 'slim',
        metadata: {
            createdAt: new Date().toISOString(),
            durationSeconds: 0,
            editor: 'vscode',
            aiProvider: 'copilot',
            replicable: false,
            ...metadata,
        },
        steps: [],
        outcome: {
            status: 'abandoned',
            summary: 'Recording in progress',
            filesCreated: 0,
            filesModified: 0,
            canReplicate: false,
        },
    };
}
function detectEditor() {
    // Try to detect the editor from environment or known identifiers
    const appName = process.env.VSCODE_GIT_ASKPASS_NODE || '';
    if (appName.toLowerCase().includes('cursor'))
        return 'cursor';
    if (appName.toLowerCase().includes('windsurf'))
        return 'windsurf';
    return 'vscode';
}
function detectAIProvider() {
    // Default to copilot for VS Code
    return 'copilot';
}
