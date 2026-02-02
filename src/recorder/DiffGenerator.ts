import * as Diff from 'diff';
import { FileDiff } from '../types';

/**
 * Generates diffs between file versions
 */
export class DiffGenerator {
  /**
   * Generate a unified diff between two strings
   */
  generateDiff(
    filePath: string,
    oldContent: string,
    newContent: string
  ): FileDiff {
    const patch = Diff.createPatch(
      filePath,
      oldContent,
      newContent,
      'original',
      'modified'
    );

    const { linesAdded, linesRemoved } = this.countChanges(patch);

    return {
      filePath,
      changeType: 'modify',
      diff: patch,
      linesAdded,
      linesRemoved,
    };
  }

  /**
   * Generate diff for a newly created file
   */
  generateCreateDiff(filePath: string, content: string): FileDiff {
    const patch = Diff.createPatch(filePath, '', content, 'empty', 'created');
    const lineCount = content.split('\n').length;

    return {
      filePath,
      changeType: 'create',
      diff: patch,
      linesAdded: lineCount,
      linesRemoved: 0,
    };
  }

  /**
   * Generate diff for a deleted file
   */
  generateDeleteDiff(filePath: string, content: string): FileDiff {
    const patch = Diff.createPatch(filePath, content, '', 'original', 'deleted');
    const lineCount = content.split('\n').length;

    return {
      filePath,
      changeType: 'delete',
      diff: patch,
      linesAdded: 0,
      linesRemoved: lineCount,
    };
  }

  /**
   * Generate diff for a renamed file
   */
  generateRenameDiff(
    oldPath: string,
    newPath: string,
    oldContent: string,
    newContent: string
  ): FileDiff {
    const patch = Diff.createPatch(
      newPath,
      oldContent,
      newContent,
      `renamed from ${oldPath}`,
      'modified'
    );
    const { linesAdded, linesRemoved } = this.countChanges(patch);

    return {
      filePath: newPath,
      changeType: 'rename',
      diff: patch,
      oldPath,
      linesAdded,
      linesRemoved,
    };
  }

  /**
   * Count added and removed lines from a unified diff
   */
  private countChanges(patch: string): { linesAdded: number; linesRemoved: number } {
    const lines = patch.split('\n');
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        linesAdded++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        linesRemoved++;
      }
    }

    return { linesAdded, linesRemoved };
  }

  /**
   * Check if two strings are different
   */
  hasChanges(oldContent: string, newContent: string): boolean {
    return oldContent !== newContent;
  }

  /**
   * Get a summary of changes
   */
  getChangeSummary(diff: FileDiff): string {
    const parts: string[] = [];
    
    if (diff.linesAdded > 0) {
      parts.push(`+${diff.linesAdded}`);
    }
    if (diff.linesRemoved > 0) {
      parts.push(`-${diff.linesRemoved}`);
    }

    return parts.join(', ') || 'no changes';
  }
}
