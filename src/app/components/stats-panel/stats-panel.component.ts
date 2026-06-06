import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { GraphAnalysis, AnchorLoadInfo, AnchorDynamicLoad, GraphHighlight, NODE_TYPE_MAP, RISK_LEVEL_MAP } from '../../models/cave-graph.model';

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
    MatDividerModule,
    MatExpansionModule
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

        <mat-accordion class="analysis-accordion">
          <mat-expansion-panel expanded="true">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon [ngClass]="{'warning-icon': dynamicOverloadedCount > 0}">fitness_center</mat-icon>
                锚点动态负载
              </mat-panel-title>
              <mat-panel-description>
                {{ dynamicAnchorLoads.length }} 个锚点
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let anchor of dynamicAnchorLoads" class="anchor-item">
                <span matListItemTitle class="anchor-name">
                  {{ anchor.nodeName }}
                  <span class="utilization-badge" [ngClass]="getUtilizationClass(anchor.utilization)">
                    {{ anchor.utilization.toFixed(0) }}%
                  </span>
                </span>
                <span matListItemLine class="anchor-load">
                  动态: {{ anchor.dynamicLoad.toFixed(0) }} / {{ anchor.maxLoad.toFixed(0) }} kg
                </span>
                <span matListItemLine class="anchor-sub" *ngIf="anchor.peakLoadMembers.length > 0">
                  峰值成员: {{ anchor.peakLoadMembers.join(', ') }}
                </span>
              </mat-list-item>
            </mat-list>
            <div class="empty-hint" *ngIf="dynamicAnchorLoads.length === 0">
              暂无锚点数据
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel expanded="true" *ngIf="highlights">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="highlight-icon">highlight</mat-icon>
                关键元素高亮
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="highlight-section" *ngIf="highlights.keyAnchors.length > 0">
              <h4 class="section-subtitle">
                <span class="dot key-anchor-dot"></span>
                关键锚点 ({{ highlights.keyAnchors.length }})
              </h4>
              <p class="section-desc">连接多条路线的重要锚点</p>
              <mat-list dense>
                <mat-list-item *ngFor="let nodeId of highlights.keyAnchors">
                  <span class="key-anchor-item">{{ getNodeName(nodeId) }}</span>
                </mat-list-item>
              </mat-list>
            </div>

            <div class="highlight-section" *ngIf="highlights.bottleneckSegments.length > 0">
              <h4 class="section-subtitle">
                <span class="dot bottleneck-dot"></span>
                瓶颈路线 ({{ highlights.bottleneckSegments.length }})
              </h4>
              <p class="section-desc">移除后会导致节点不可达的关键绳段</p>
              <mat-list dense>
                <mat-list-item *ngFor="let segId of highlights.bottleneckSegments">
                  <span class="bottleneck-item">{{ getSegmentName(segId) }}</span>
                </mat-list-item>
              </mat-list>
            </div>

            <div class="highlight-section" *ngIf="highlights.dangerZones.length > 0">
              <h4 class="section-subtitle">
                <span class="dot danger-dot"></span>
                危险区域 ({{ highlights.dangerZones.length }})
              </h4>
              <mat-list dense>
                <mat-list-item *ngFor="let nodeId of highlights.dangerZones">
                  <span class="danger-item">{{ getNodeName(nodeId) }}</span>
                </mat-list-item>
              </mat-list>
            </div>

            <div class="empty-hint" *ngIf="!hasHighlights">
              暂无高亮数据
            </div>
          </mat-expansion-panel>
        </mat-accordion>

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
    .analysis-accordion {
      margin: 8px 0;
    }
    .anchor-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .anchor-name {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
    }
    .utilization-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    .utilization-low {
      background: #4caf50;
    }
    .utilization-medium {
      background: #ff9800;
    }
    .utilization-high {
      background: #f44336;
    }
    .anchor-load {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .anchor-sub {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
    }
    .warning-icon {
      color: #ff9800;
    }
    .highlight-icon {
      color: #9c27b0;
    }
    .highlight-section {
      margin-bottom: 12px;
    }
    .section-subtitle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #333;
    }
    .section-desc {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
      margin: 0 0 8px 0;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .key-anchor-dot {
      background: #9c27b0;
    }
    .bottleneck-dot {
      background: #ff9800;
    }
    .danger-dot {
      background: #f44336;
    }
    .key-anchor-item, .bottleneck-item, .danger-item {
      font-size: 12px;
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
    .empty-hint {
      text-align: center;
      padding: 16px;
      color: #999;
      font-size: 12px;
    }
    ::ng-deep .mat-mdc-list-base {
      padding-top: 0;
    }
  `]
})
export class StatsPanelComponent {
  @Input() analysis: GraphAnalysis | null = null;
  @Input() nodeNames: Record<string, string> = {};
  @Input() segments: { id: string; sourceId: string; targetId: string }[] = [];

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

  get overloadedAnchors(): AnchorLoadInfo[] {
    return this.analysis?.overloadedAnchors ?? [];
  }

  get dynamicAnchorLoads(): AnchorDynamicLoad[] {
    return this.analysis?.dynamicAnchorLoads ?? [];
  }

  get dynamicOverloadedCount(): number {
    return this.dynamicAnchorLoads.filter(a => a.isOverloaded).length;
  }

  get highlights(): GraphHighlight | null {
    return this.analysis?.highlights ?? null;
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

  get hasHighlights(): boolean {
    if (!this.highlights) return false;
    return this.highlights.keyAnchors.length > 0 ||
           this.highlights.bottleneckSegments.length > 0 ||
           this.highlights.dangerZones.length > 0;
  }

  getUtilizationClass(utilization: number): string {
    if (utilization < 60) return 'utilization-low';
    if (utilization < 90) return 'utilization-medium';
    return 'utilization-high';
  }

  getNodeName(nodeId: string): string {
    return this.nodeNames[nodeId] || nodeId;
  }

  getSegmentName(segId: string): string {
    const seg = this.segments.find(s => s.id === segId);
    if (!seg) return segId;
    const sourceName = this.getNodeName(seg.sourceId);
    const targetName = this.getNodeName(seg.targetId);
    return `${sourceName} ↔ ${targetName}`;
  }
}
