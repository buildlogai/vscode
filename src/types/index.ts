/**
 * Buildlog Types - Local type definitions
 * These mirror the @buildlog/types package structure
 */

export interface BuildlogFile {
  version: string;
  metadata: BuildlogMetadata;
  events: BuildlogEvent[];
  snapshots: {
    initial: FileSnapshot[];
    final: FileSnapshot[];
  };
}

export interface BuildlogMetadata {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  workspaceName: string;
  workspacePath: string;
  filesChanged: number;
  totalEvents: number;
}

export interface BuildlogEvent {
  id: string;
  type: BuildlogEventType;
  timestamp: string;
  data: EventData;
}

export type BuildlogEventType = 
  | 'file_change'
  | 'prompt'
  | 'response'
  | 'note';

export type EventData = 
  | FileChangeEventData
  | PromptEventData
  | ResponseEventData
  | NoteEventData;

export interface FileChangeEventData {
  type: 'file_change';
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  diff?: string;
  oldPath?: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface PromptEventData {
  type: 'prompt';
  content: string;
  model?: string;
}

export interface ResponseEventData {
  type: 'response';
  content: string;
  model?: string;
}

export interface NoteEventData {
  type: 'note';
  content: string;
  tags?: string[];
}

export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  size: number;
  lastModified: string;
}

export interface FileDiff {
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  diff: string;
  oldPath?: string;
  linesAdded: number;
  linesRemoved: number;
}
