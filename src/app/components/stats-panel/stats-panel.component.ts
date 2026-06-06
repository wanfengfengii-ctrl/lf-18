import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { GraphAnalysis, AnchorLoadInfo, NODE_TYPE_MAP, RISK_LEVEL_MAP } from '../../models/cave-graph.model';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatDividerModule
  ],
  template: `
    <mat-card class="stats-panel">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>analytics</mat-icon>
          路线统计分析
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">总长度</span>
            <span class="stat-value">{{ totalLength.toFixed(1) }} m</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">节点数量</span>
            <span class="stat-value">{{ nodeCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">绳段数量</span>
            <span class="stat-value">{{ segmentCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">入口数量</span>
            <span class="stat-value">{{ entranceCount }}</span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="warning-section" *ngIf="overloadedAnchors.length > 0">
          <h3 class="warning-title overload">
            <mat-icon>warning_amber</mat-icon>
            超载锚点 ({{ overloadedAnchors.length }})
          </h3>
          <mat-list dense>
            <mat-list-item *ngFor="let anchor of overloadedAnchors">
              <span matListItemTitle>{{ anchor.nodeName }}</span>
              <span matListItemLine class="overload-text">
                预计负载: {{ anchor.totalLoad.toFixed(0) }} kg / 上限: {{ anchor.maxLoad.toFixed(0) }} kg
              </span>
            </mat-list-item>
          </mat-list>
        </div>

        <div class="warning-section" *ngIf="disconnectedNodes.length > 0">
          <h3 class="warning-title danger">
            <mat-icon>error</mat-icon>
            无法返回入口的节点 ({{ disconnectedNodes.length }})
          </h3>
          <mat-list dense>
            <mat-list-item *ngFor="let nodeId of disconnectedNodes">
              <span matListItemTitle class="danger-text">{{ getNodeName(nodeId) }}</span>
              <span matListItemLine class="danger-subtext">
                该节点没有通往入口的路径
              </span>
            </mat-list-item>
          </mat-list>
        </div>

        <div class="all-clear" *ngIf="allClear">
          <mat-icon class="check-icon">check_circle</mat-icon>
          <p>所有节点连通正常，无超载锚点</p>
        </div>

        <div class="empty-state" *ngIf="!hasData">
          <mat-icon class="empty-icon">map</mat-icon>
          <p>暂无数据，请添加节点和绳段</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .stats-panel {
      margin: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 16px 0;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      padding: 12px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
    }
    .stat-label {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }
    .warning-section {
      margin-top: 16px;
    }
    .warning-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      margin: 0 0 8px 0;
    }
    .warning-title.overload {
      color: #ff6b00;
    }
    .warning-title.danger {
      color: #f44336;
    }
    .overload-text {
      color: #ff6b00;
      font-size: 12px;
    }
    .danger-text {
      color: #f44336;
      font-weight: 500;
    }
    .danger-subtext {
      color: #f44336;
      font-size: 11px;
      opacity: 0.8;
    }
    .all-clear {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 0;
      color: #4caf50;
    }
    .check-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 0;
      color: #999;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
    ::ng-deep .mat-mdc-list-base {
      padding-top: 0;
    }
  `]
})
export class StatsPanelComponent {
  @Input() analysis: GraphAnalysis | null = null;
  @Input() nodeNames: Record<string, string> = {};

  @Output() nodeClick = new EventEmitter<string>();

  get totalLength(): number {
    return this.analysis?.totalLength ?? 0;
  }

  get nodeCount(): number {
    return this.analysis?.nodeCount ?? 0;
  }

  get segmentCount(): number {
    return this.analysis?.segmentCount ?? 0;
  }

  get entranceCount(): number {
    return this.analysis?.entranceNodes.length ?? 0;
  }

  get overloadedAnchors(): any[] {
    return this.analysis?.overloadedAnchors ?? [];
  }

  get disconnectedNodes(): string[] {
    return this.analysis?.disconnectedNodes ?? [];
  }

  get hasData(): boolean {
    return this.nodeCount > 0;
  }

  get allClear(): boolean {
    return this.hasData && this.overloadedAnchors.length === 0 && this.disconnectedNodes.length === 0;
  }

  getNodeName(nodeId: string): string {
    return this.nodeNames[nodeId] || nodeId;
  }
}
