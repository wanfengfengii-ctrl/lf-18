import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
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
    MatDividerModule
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
          <p class="path-count">
            找到 {{ paths.length }} 条返回入口的路线
          </p>

          <mat-divider></mat-divider>

          <mat-list class="path-list">
            <mat-list-item *ngFor="let path of paths; let i = index" class="path-item">
              <div matListItemTitle class="path-title">
                <span class="path-index">路线 {{ i + 1 }}</span>
                <span class="path-length">{{ path.totalLength.toFixed(1) }} m</span>
              </div>
              <div matListItemLine class="path-nodes">
                <span *ngFor="let nodeId of path.path; let last = last">
                  {{ getNodeName(nodeId) }}
                  <span *ngIf="!last"> → </span>
                </span>
              </div>
              <div matListItemLine>
                <span class="risk-badge" [style.backgroundColor]="getRiskColor(path.maxRisk)">
                  {{ getRiskLabel(path.maxRisk) }}
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
export class PathAnalysisComponent {
  @Input() nodeOptions: { id: string; name: string }[] = [];
  @Input() paths: PathResult[] = [];
  @Input() nodeNames: Record<string, string> = {};

  @Output() nodeSelect = new EventEmitter<string>();

  selectedNodeId = new FormControl('');

  onNodeChange(): void {
    if (this.selectedNodeId.value) {
      this.nodeSelect.emit(this.selectedNodeId.value);
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
