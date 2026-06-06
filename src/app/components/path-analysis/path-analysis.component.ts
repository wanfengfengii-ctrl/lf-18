import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PathResult, RISK_LEVEL_MAP } from '../../models/cave-graph.model';

@Component({
  selector: 'app-path-analysis',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatButtonToggleModule
  ],
  template: `
    <mat-card class="path-analysis">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>route</mat-icon>
          撤离路线分析
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>选择节点</mat-label>
          <mat-select [formControl]="selectedNodeId" (selectionChange)="onNodeChange()">
            <mat-option *ngFor="let node of nodeOptions" [value]="node.id">
              {{ node.name }} ({{ node.id }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div *ngIf="selectedNodeId.value && paths.length === 0" class="no-path">
          <mat-icon class="warning-icon">warning</mat-icon>
          <p>该节点没有通往入口的路径！</p>
        </div>

        <div *ngIf="paths.length > 0">
          <div class="path-header">
            <p class="path-count">
              找到 {{ paths.length }} 条返回入口的路线
            </p>
            <mat-button-toggle-group [formControl]="sortMode" class="sort-toggle">
              <mat-button-toggle value="length">
                <mat-icon>straighten</mat-icon>
                最短
              </mat-button-toggle>
              <mat-button-toggle value="risk">
                <mat-icon>shield</mat-icon>
                最安全
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <mat-divider></mat-divider>

          <mat-list class="path-list">
            <mat-list-item *ngFor="let path of sortedPaths; let i = index" class="path-item"
                           (click)="onPathSelect(path)"
                           [ngClass]="{'selected': selectedPathIndex === i}">
              <div matListItemTitle class="path-title">
                <span class="path-index">
                  {{ i === 0 && sortMode.value === 'risk' ? '🏆 ' : '' }}路线 {{ i + 1 }}
                </span>
                <span class="path-length">{{ path.totalLength.toFixed(1) }} m</span>
              </div>
              <div matListItemLine class="path-nodes">
                <span *ngFor="let nodeId of path.path; let last = last">
                  {{ getNodeName(nodeId) }}
                  <span *ngIf="!last"> → </span>
                </span>
              </div>
              <div matListItemLine class="path-meta">
                <span class="risk-badge" [style.backgroundColor]="getRiskColor(path.maxRisk)">
                  {{ getRiskLabel(path.maxRisk) }}
                </span>
                <span class="risk-score" *ngIf="sortMode.value === 'risk'">
                  风险评分: {{ path.riskScore.toFixed(1) }}
                </span>
              </div>
            </mat-list-item>
          </mat-list>
        </div>

        <div *ngIf="!selectedNodeId.value" class="hint">
          <mat-icon>info</mat-icon>
          <p>选择一个节点查看返回入口的可用路线</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .path-analysis {
      margin: 8px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .path-count {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
      margin: 8px 0;
    }
    .path-list {
      max-height: 300px;
      overflow-y: auto;
    }
    .path-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    .path-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .path-index {
      font-weight: 600;
    }
    .path-length {
      color: #1976d2;
      font-size: 13px;
    }
    .path-nodes {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.7);
      margin: 4px 0;
    }
    .risk-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      color: white;
      font-size: 11px;
    }
    .no-path {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 0;
      color: #f44336;
    }
    .warning-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
    .path-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .path-count {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
      margin: 8px 0;
    }
    .sort-toggle {
      font-size: 12px;
    }
    .sort-toggle .mat-mdc-button-toggle-label-content {
      padding: 4px 8px !important;
      line-height: 24px !important;
    }
    .path-item {
      cursor: pointer;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      transition: background-color 0.2s;
    }
    .path-item:hover {
      background: rgba(0, 188, 212, 0.08);
    }
    .path-item.selected {
      background: rgba(0, 230, 118, 0.12);
    }
    .path-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .path-index {
      font-weight: 600;
    }
    .path-length {
      color: #1976d2;
      font-size: 13px;
    }
    .path-nodes {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.7);
      margin: 4px 0;
    }
    .path-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .risk-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      color: white;
      font-size: 11px;
    }
    .risk-score {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
    }
    .hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 0;
      color: #999;
    }
    .hint p {
      margin: 8px 0 0 0;
      font-size: 13px;
    }
  `]
})
export class PathAnalysisComponent implements OnChanges {
  @Input() nodeOptions: { id: string; name: string }[] = [];
  @Input() paths: PathResult[] = [];
  @Input() nodeNames: Record<string, string> = {};
  @Input() selectedNode: string | null = null;

  @Output() nodeSelect = new EventEmitter<string>();
  @Output() pathHighlight = new EventEmitter<{ nodes: string[]; segments: string[] }>();

  selectedNodeId = new FormControl('');
  sortMode = new FormControl('length');
  selectedPathIndex: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedNode'] && this.selectedNode) {
      this.selectedNodeId.setValue(this.selectedNode, { emitEvent: false });
    }
    if (changes['paths']) {
      this.selectedPathIndex = null;
      this.pathHighlight.emit({ nodes: [], segments: [] });
    }
  }

  get sortedPaths(): PathResult[] {
    const paths = [...this.paths];
    if (this.sortMode.value === 'risk') {
      return paths.sort((a, b) => a.riskScore - b.riskScore);
    }
    return paths.sort((a, b) => a.totalLength - b.totalLength);
  }

  onNodeChange(): void {
    if (this.selectedNodeId.value) {
      this.nodeSelect.emit(this.selectedNodeId.value);
      this.selectedPathIndex = null;
    }
  }

  onPathSelect(path: PathResult): void {
    const index = this.sortedPaths.indexOf(path);
    this.selectedPathIndex = this.selectedPathIndex === index ? null : index;

    if (this.selectedPathIndex !== null) {
      this.pathHighlight.emit({
        nodes: path.path,
        segments: path.segments
      });
    } else {
      this.pathHighlight.emit({ nodes: [], segments: [] });
    }
  }

  getNodeName(nodeId: string): string {
    return this.nodeNames[nodeId] || nodeId;
  }

  getRiskColor(risk: string): string {
    return (RISK_LEVEL_MAP as any)[risk]?.color || '#999';
  }

  getRiskLabel(risk: string): string {
    return (RISK_LEVEL_MAP as any)[risk]?.label || risk;
  }
}
