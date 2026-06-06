import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { RouteVersion, RouteComparison } from '../../models/cave-graph.model';

@Component({
  selector: 'app-route-version-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDividerModule,
    MatDialogModule
  ],
  template: `
    <mat-card class="version-panel">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>history</mat-icon>
          路线版本管理
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="saveForm" (ngSubmit)="onSaveVersion()" class="save-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>版本名称</mat-label>
            <input matInput formControlName="name" placeholder="请输入版本名称">
            <mat-icon matSuffix>label</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>版本描述</mat-label>
            <textarea matInput formControlName="description" placeholder="请输入版本描述（可选）" rows="2"></textarea>
            <mat-icon matSuffix>description</mat-icon>
          </mat-form-field>
          <button mat-raised-button color="primary" type="submit" [disabled]="saveForm.invalid">
            <mat-icon>save</mat-icon>
            保存为新版本
          </button>
        </form>

        <mat-divider></mat-divider>

        <div class="section-title">
          <mat-icon>list</mat-icon>
          版本列表
          <span class="version-count">({{ versions.length }})</span>
        </div>

        <div class="version-list" *ngIf="versions.length > 0">
          <mat-list>
            <mat-list-item *ngFor="let version of versions" class="version-item">
              <div class="version-info">
                <div class="version-header">
                  <span class="version-name">{{ version.name }}</span>
                  <span class="version-date">{{ formatDate(version.createdAt) }}</span>
                </div>
                <div class="version-stats">
                  <span class="stat">
                    <mat-icon>location_on</mat-icon>
                    {{ version.nodes.length }} 节点
                  </span>
                  <span class="stat">
                    <mat-icon>route</mat-icon>
                    {{ version.segments.length }} 绳段
                  </span>
                </div>
                <div class="version-desc" *ngIf="version.description">
                  {{ version.description }}
                </div>
              </div>
              <div class="version-actions">
                <button mat-icon-button color="primary" (click)="onLoadVersion(version.id)" matTooltip="加载版本">
                  <mat-icon>download</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="onDeleteVersion(version.id)" matTooltip="删除版本">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </mat-list-item>
          </mat-list>
        </div>

        <div class="empty-state" *ngIf="versions.length === 0">
          <mat-icon class="empty-icon">folder_open</mat-icon>
          <p>暂无保存的版本</p>
        </div>

        <mat-divider></mat-divider>

        <div class="section-title">
          <mat-icon>compare_arrows</mat-icon>
          版本对比
        </div>

        <div class="compare-form" *ngIf="versions.length >= 2">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>版本 A</mat-label>
            <mat-select formControlName="versionA" [(value)]="selectedVersionA">
              <mat-option *ngFor="let version of versions" [value]="version.id">
                {{ version.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>版本 B</mat-label>
            <mat-select formControlName="versionB" [(value)]="selectedVersionB">
              <mat-option *ngFor="let version of versions" [value]="version.id">
                {{ version.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-raised-button color="accent" (click)="onCompareVersions()" 
                  [disabled]="!selectedVersionA || !selectedVersionB || selectedVersionA === selectedVersionB">
            <mat-icon>compare</mat-icon>
            开始对比
          </button>
        </div>

        <div class="empty-state" *ngIf="versions.length < 2">
          <p class="hint-text">至少需要 2 个版本才能进行对比</p>
        </div>

        <div class="comparison-result" *ngIf="comparison">
          <mat-divider></mat-divider>
          <div class="section-title">
            <mat-icon>diff</mat-icon>
            对比结果
          </div>
          <div class="compare-summary">
            <div class="compare-labels">
              <span class="label-a">{{ comparison.versionA.name }}</span>
              <mat-icon>arrow_forward</mat-icon>
              <span class="label-b">{{ comparison.versionB.name }}</span>
            </div>
          </div>
          <div class="diff-grid">
            <div class="diff-item added">
              <div class="diff-icon">
                <mat-icon>add_circle</mat-icon>
              </div>
              <div class="diff-content">
                <span class="diff-label">新增节点</span>
                <span class="diff-value">{{ comparison.addedNodes.length }}</span>
              </div>
            </div>
            <div class="diff-item removed">
              <div class="diff-icon">
                <mat-icon>remove_circle</mat-icon>
              </div>
              <div class="diff-content">
                <span class="diff-label">删除节点</span>
                <span class="diff-value">{{ comparison.removedNodes.length }}</span>
              </div>
            </div>
            <div class="diff-item added">
              <div class="diff-icon">
                <mat-icon>add_circle</mat-icon>
              </div>
              <div class="diff-content">
                <span class="diff-label">新增绳段</span>
                <span class="diff-value">{{ comparison.addedSegments.length }}</span>
              </div>
            </div>
            <div class="diff-item removed">
              <div class="diff-icon">
                <mat-icon>remove_circle</mat-icon>
              </div>
              <div class="diff-content">
                <span class="diff-label">删除绳段</span>
                <span class="diff-value">{{ comparison.removedSegments.length }}</span>
              </div>
            </div>
          </div>
          <mat-divider></mat-divider>
          <div class="diff-details">
            <div class="detail-row">
              <span class="detail-label">
                <mat-icon>straighten</mat-icon>
                总长度差异
              </span>
              <span class="detail-value" [ngClass]="{'positive': comparison.totalLengthDiff > 0, 'negative': comparison.totalLengthDiff < 0}">
                {{ comparison.totalLengthDiff > 0 ? '+' : '' }}{{ comparison.totalLengthDiff.toFixed(2) }} m
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">
                <mat-icon>warning</mat-icon>
                风险差异
              </span>
              <span class="detail-value">
                {{ comparison.riskLevelDiff }}
              </span>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .version-panel {
      margin: 8px;
    }
    .save-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 16px 0;
    }
    .full-width {
      width: 100%;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
      margin: 16px 0 12px 0;
    }
    .version-count {
      font-size: 13px;
      font-weight: 400;
      color: rgba(0, 0, 0, 0.54);
    }
    .version-list {
      max-height: 300px;
      overflow-y: auto;
    }
    .version-item {
      border-radius: 8px;
      margin-bottom: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    .version-item ::ng-deep .mdc-list-item__content {
      padding: 8px 0 !important;
    }
    .version-info {
      flex: 1;
      min-width: 0;
    }
    .version-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .version-name {
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
    }
    .version-date {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.54);
      white-space: nowrap;
    }
    .version-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 4px;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .stat mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .version-desc {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .version-actions {
      display: flex;
      gap: 4px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 0;
      color: #999;
    }
    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
    }
    .hint-text {
      font-size: 13px;
      margin: 0;
    }
    .compare-form {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
    }
    .half-width {
      flex: 1;
      min-width: 120px;
    }
    .comparison-result {
      margin-top: 8px;
    }
    .compare-summary {
      margin-bottom: 16px;
    }
    .compare-labels {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
    }
    .label-a, .label-b {
      font-size: 13px;
      font-weight: 600;
    }
    .label-a {
      color: #1976d2;
    }
    .label-b {
      color: #388e3c;
    }
    .diff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .diff-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    .diff-item.added .diff-icon {
      color: #4caf50;
    }
    .diff-item.removed .diff-icon {
      color: #f44336;
    }
    .diff-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .diff-content {
      display: flex;
      flex-direction: column;
    }
    .diff-label {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }
    .diff-value {
      font-size: 20px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.87);
    }
    .diff-details {
      margin-top: 16px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
    }
    .detail-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }
    .detail-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 600;
    }
    .detail-value.positive {
      color: #4caf50;
    }
    .detail-value.negative {
      color: #f44336;
    }
    ::ng-deep .mat-mdc-card-header {
      padding-bottom: 8px;
    }
    ::ng-deep .mat-mdc-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px !important;
    }
    ::ng-deep .mat-mdc-card-title mat-icon {
      font-size: 24px;
    }
  `]
})
export class RouteVersionPanelComponent implements OnInit {
  @Input() versions: RouteVersion[] = [];
  @Input() comparison: RouteComparison | null = null;

  @Output() saveVersion = new EventEmitter<{name: string; description?: string}>();
  @Output() loadVersion = new EventEmitter<string>();
  @Output() deleteVersion = new EventEmitter<string>();
  @Output() compareVersions = new EventEmitter<{versionAId: string; versionBId: string}>();

  saveForm: FormGroup;
  selectedVersionA: string | null = null;
  selectedVersionB: string | null = null;

  constructor(private fb: FormBuilder) {
    this.saveForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['']
    });
  }

  ngOnInit(): void {
    if (this.versions.length >= 2) {
      this.selectedVersionA = this.versions[0].id;
      this.selectedVersionB = this.versions[1].id;
    } else if (this.versions.length === 1) {
      this.selectedVersionA = this.versions[0].id;
    }
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  onSaveVersion(): void {
    if (this.saveForm.valid) {
      const { name, description } = this.saveForm.value;
      this.saveVersion.emit({
        name,
        description: description || undefined
      });
      this.saveForm.reset({ name: '', description: '' });
    }
  }

  onLoadVersion(versionId: string): void {
    this.loadVersion.emit(versionId);
  }

  onDeleteVersion(versionId: string): void {
    this.deleteVersion.emit(versionId);
  }

  onCompareVersions(): void {
    if (this.selectedVersionA && this.selectedVersionB && this.selectedVersionA !== this.selectedVersionB) {
      this.compareVersions.emit({
        versionAId: this.selectedVersionA,
        versionBId: this.selectedVersionB
      });
    }
  }
}
