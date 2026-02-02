"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v4 = v4;
/**
 * Simple UUID v4 generator
 * Replaces the uuid package for smaller bundle size
 */
function v4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
