import * as vscode from 'vscode';
import { RecordingSession, RecordingState } from '../recorder';

/**
 * Manages the status bar UI for recording state
 */
export class StatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private session: RecordingSession;
  private updateInterval: NodeJS.Timeout | undefined;

  constructor(session: RecordingSession) {
    this.session = session;
    
    // Create status bar item on the left side
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    // Subscribe to state changes
    session.onStateChange(state => this.updateDisplay(state));
    
    // Initial update
    this.updateDisplay(session.getState());
    this.statusBarItem.show();
  }

  /**
   * Update the status bar display based on recording state
   */
  private updateDisplay(state: RecordingState): void {
    switch (state) {
      case 'recording':
        this.startRecordingDisplay();
        break;
      case 'paused':
        this.showPausedDisplay();
        break;
      case 'idle':
      default:
        this.showIdleDisplay();
        break;
    }
  }

  /**
   * Show the idle (not recording) display
   */
  private showIdleDisplay(): void {
    this.stopTimer();
    
    this.statusBarItem.text = '$(circle-outline) Buildlog';
    this.statusBarItem.tooltip = 'Click to start recording';
    this.statusBarItem.command = 'buildlog.startRecording';
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Start the recording display with timer
   */
  private startRecordingDisplay(): void {
    this.updateRecordingDisplay();
    
    // Update every second
    this.updateInterval = setInterval(() => {
      this.updateRecordingDisplay();
    }, 1000);
  }

  /**
   * Update the recording display with current time
   */
  private updateRecordingDisplay(): void {
    const duration = this.session.getDuration();
    const timeString = this.formatDuration(duration);
    const stepCount = this.session.getStepCount();
    const promptCount = this.session.getPromptCount();

    this.statusBarItem.text = `$(circle-filled) REC ${timeString}`;
    this.statusBarItem.tooltip = `Recording: ${this.session.getTitle()}\n${stepCount} steps (${promptCount} prompts)\nClick to stop`;
    this.statusBarItem.command = 'buildlog.stopRecording';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  /**
   * Show the paused display
   */
  private showPausedDisplay(): void {
    this.stopTimer();
    
    const duration = this.session.getDuration();
    const timeString = this.formatDuration(duration);

    this.statusBarItem.text = `$(debug-pause) PAUSED ${timeString}`;
    this.statusBarItem.tooltip = 'Recording paused. Click to resume.';
    this.statusBarItem.command = 'buildlog.startRecording';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  /**
   * Format duration in HH:MM:SS format
   */
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Stop the update timer
   */
  private stopTimer(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  dispose(): void {
    this.stopTimer();
    this.statusBarItem.dispose();
  }
}
