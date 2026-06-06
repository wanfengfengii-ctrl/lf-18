import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface OverloadConfirmData {
  overloadedAnchors: { nodeId: string; nodeName: string; totalLoad: number; maxLoad: number }[];
  segmentName: string;
}

@Component({
  selector: 'app-overload-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="warning-icon">warning_amber</mat-icon>
      锚点超载警告
    </h2>
    <mat-dialog-content>
      <p>保存此绳段将导致以下锚点超载，是否继续？</p>
      <div class="anchor-list">
        <div class="anchor-item" *ngFor="let anchor of data.overloadedAnchors">
          <span class="anchor-name">{{ anchor.nodeName }}</span>
          <span class="anchor-load">
            <span class="load-value overload">{{ anchor.totalLoad.toFixed(0) }} kg</span>
            <span class="load-sep">/</span>
            <span class="load-value">{{ anchor.maxLoad.toFixed(0) }} kg</span>
          </span>
        </div>
      </div>
      <p class="warning-text">
        <mat-icon class="small-icon">error</mat-icon>
        超载可能导致锚点失效，存在安全风险！
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">确认保存</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ff6b00;
      margin: 0;
    }
    .warning-icon {
      color: #ff6b00;
    }
    .anchor-list {
      margin: 16px 0;
    }
    .anchor-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #fff3e0;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 4px solid #ff6b00;
    }
    .anchor-name {
      font-weight: 500;
    }
    .anchor-load {
      font-size: 13px;
      font-family: monospace;
    }
    .load-value.overload {
      color: #ff6b00;
      font-weight: 600;
    }
    .load-sep {
      color: #999;
      margin: 0 4px;
    }
    .warning-text {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #f44336;
      font-size: 13px;
      margin-top: 12px;
    }
    .small-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class OverloadConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<OverloadConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OverloadConfirmData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
