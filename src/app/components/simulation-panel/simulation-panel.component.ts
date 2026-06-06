import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { CaveNode, RopeSegment, SimulationResult, NODE_TYPE_MAP } from '../../models/cave-graph.model';

@Component({
  selector: 'app-simulation-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatDividerModule,
    MatBadgeModule
  ],
  template: `
    <mat-card class="simulation-panel">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>science</mat-icon>
          演练模式
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="mode-toggle-section">
          <button 
            mat-raised-button 
            [color]="isSimulationMode ? 'warn' : 'primary'"
            (click)="onToggleMode()">
            <mat-icon>{{ isSimulationMode ? 'exit_to_app' : 'play_arrow' }}</mat-icon>
            {{ isSimulationMode ? '退出演练模式' : '进入演练模式' }}
          </button>
        </div>

        <ng-container *ngIf="isSimulationMode">
          <mat-divider></mat-divider>

          <mat-accordion class="simulation-accordion">
            <mat-expansion-panel expanded="true">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>location_on</mat-icon>
                  模拟删除节点
                </mat-panel-title>
                <mat-panel-description>
                  排除入口类型，共 {{ selectableNodes.length }} 个
                </mat-panel-description>
              </mat-expansion-panel-header>
              <div class="checkbox-list">
                <mat-list dense>
                  <mat-list-item *ngFor="let node of selectableNodes">
                    <mat-checkbox 
                      [checked]="removedNodes.includes(node.id)"
                      (change)="onNodeToggle(node.id)">
                      <span class="node-item">
                        <span class="node-icon" [style.background-color]="getNodeTypeColor(node.type)"></span>
                        <span class="node-name">{{ node.name }}</span>
                        <span class="node-type-label">{{ getNodeTypeLabel(node.type) }}</span>
                      </span>
                    </mat-checkbox>
                  </mat-list-item>
                </mat-list>
                <div class="empty-hint" *ngIf="selectableNodes.length === 0">
                  暂无可选节点
                </div>
              </div>
            </mat-expansion-panel>

            <mat-expansion-panel expanded="true">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>linear_scale</mat-icon>
                  模拟删除绳段
                </mat-panel-title>
                <mat-panel-description>
                  共 {{ segments.length }} 个
                </mat-panel-description>
              </mat-expansion-panel-header>
              <div class="checkbox-list">
                <mat-list dense>
                  <mat-list-item *ngFor="let segment of segments">
                    <mat-checkbox 
                      [checked]="removedSegments.includes(segment.id)"
                      (change)="onSegmentToggle(segment.id)">
                      <span class="segment-item">
                        <span class="segment-name">{{ getSegmentName(segment) }}</span>
                        <span class="segment-length">{{ segment.length }}m</span>
                      </span>
                    </mat-checkbox>
                  </mat-list-item>
                </mat-list>
                <div class="empty-hint" *ngIf="segments.length === 0">
                  暂无可选绳段
                </div>
              </div>
            </mat-expansion-panel>
          </mat-accordion>

          <div class="run-section">
            <button 
              mat-raised-button 
              color="accent"
              [disabled]="removedNodes.length === 0 && removedSegments.length === 0"
              (click)="onRunSimulation()">
              <mat-icon>play_circle</mat-icon>
              运行模拟
            </button>
          </div>

          <ng-container *ngIf="simulationResult">
            <mat-divider></mat-divider>

            <div class="result-section">
              <h3 class="result-title">
                <mat-icon>assessment</mat-icon>
                模拟结果
              </h3>

              <div class="result-stats">
                <div class="result-stat danger">
                  <span class="stat-icon">
                    <mat-icon>error</mat-icon>
                  </span>
                  <div class="stat-info">
                    <span class="stat-number">{{ simulationResult.nowUnreachable.length }}</span>
                    <span class="stat-label">不可达节点</span>
                  </div>
                </div>

                <div class="result-stat warning">
                  <span class="stat-icon">
                    <mat-icon>warning_amber</mat-icon>
                  </span>
                  <div class="stat-info">
                    <span class="stat-number">{{ simulationResult.newOverloadedAnchors.length }}</span>
                    <span class="stat-label">新增超载锚点</span>
                  </div>
                </div>

                <div class="result-stat info">
                  <span class="stat-icon">
                    <mat-icon>trending_up</mat-icon>
                  </span>
                  <div class="stat-info">
                    <span class="stat-number">{{ simulationResult.riskIncrease.toFixed(1) }}%</span>
                    <span class="stat-label">风险变化</span>
                  </div>
                </div>
              </div>

              <div class="affected-paths" *ngIf="simulationResult.affectedPaths.length > 0">
                <h4 class="subsection-title">
                  <mat-icon>route</mat-icon>
                  受影响路径 ({{ simulationResult.affectedPaths.length }})
                </h4>
                <mat-list dense>
                  <mat-list-item *ngFor="let pathInfo of simulationResult.affectedPaths">
                    <span matListItemTitle>{{ getNodeName(pathInfo.nodeId) }}</span>
                    <span matListItemLine>
                      路径数: {{ pathInfo.originalPathCount }} → {{ pathInfo.newPathCount }}
                    </span>
                  </mat-list-item>
                </mat-list>
              </div>

              <div class="result-summary" *ngIf="simulationResult.nowUnreachable.length === 0 && simulationResult.newOverloadedAnchors.length === 0">
                <mat-icon class="check-icon">check_circle</mat-icon>
                <p>模拟结果：无明显影响</p>
              </div>
            </div>
          </ng-container>
        </ng-container>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .simulation-panel {
      margin: 8px;
    }
    .mode-toggle-section {
      padding: 16px 0;
      display: flex;
      justify-content: center;
    }
    .simulation-accordion {
      margin-top: 16px;
    }
    .checkbox-list {
      max-height: 300px;
      overflow-y: auto;
    }
    .node-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .node-icon {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .node-name {
      font-weight: 500;
    }
    .node-type-label {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
      margin-left: auto;
    }
    .segment-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .segment-name {
      font-weight: 500;
    }
    .segment-length {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
      margin-left: auto;
    }
    .empty-hint {
      text-align: center;
      padding: 16px;
      color: #999;
      font-size: 13px;
    }
    .run-section {
      padding: 16px 0;
      display: flex;
      justify-content: center;
    }
    .result-section {
      padding-top: 16px;
    }
    .result-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #333;
    }
    .result-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }
    .result-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    .result-stat .stat-icon {
      font-size: 24px;
    }
    .result-stat .stat-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .result-stat.danger .stat-icon {
      color: #f44336;
    }
    .result-stat.warning .stat-icon {
      color: #ff9800;
    }
    .result-stat.info .stat-icon {
      color: #2196f3;
    }
    .stat-info {
      display: flex;
      flex-direction: column;
    }
    .stat-number {
      font-size: 18px;
      font-weight: 700;
    }
    .stat-label {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
    }
    .subsection-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #555;
    }
    .affected-paths {
      margin-top: 8px;
    }
    .result-summary {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0;
      color: #4caf50;
    }
    .check-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
    }
    ::ng-deep .mat-mdc-list-base {
      padding-top: 0;
    }
  `]
})
export class SimulationPanelComponent {
  @Input() nodes: CaveNode[] = [];
  @Input() segments: RopeSegment[] = [];
  @Input() isSimulationMode: boolean = false;
  @Input() simulationResult: SimulationResult | null = null;
  @Input() removedNodes: string[] = [];
  @Input() removedSegments: string[] = [];

  @Output() toggleMode = new EventEmitter<void>();
  @Output() nodeToggle = new EventEmitter<string>();
  @Output() segmentToggle = new EventEmitter<string>();
  @Output() runSimulation = new EventEmitter<void>();

  get selectableNodes(): CaveNode[] {
    return this.nodes.filter(node => node.type !== 'entrance');
  }

  onToggleMode(): void {
    this.toggleMode.emit();
  }

  onNodeToggle(nodeId: string): void {
    this.nodeToggle.emit(nodeId);
  }

  onSegmentToggle(segmentId: string): void {
    this.segmentToggle.emit(segmentId);
  }

  onRunSimulation(): void {
    this.runSimulation.emit();
  }

  getNodeTypeColor(type: string): string {
    return NODE_TYPE_MAP[type as keyof typeof NODE_TYPE_MAP]?.color || '#999';
  }

  getNodeTypeLabel(type: string): string {
    return NODE_TYPE_MAP[type as keyof typeof NODE_TYPE_MAP]?.label || type;
  }

  getNodeName(nodeId: string): string {
    const node = this.nodes.find(n => n.id === nodeId);
    return node?.name || nodeId;
  }

  getSegmentName(segment: RopeSegment): string {
    const sourceName = this.getNodeName(segment.sourceId);
    const targetName = this.getNodeName(segment.targetId);
    return `${sourceName} → ${targetName}`;
  }
}
