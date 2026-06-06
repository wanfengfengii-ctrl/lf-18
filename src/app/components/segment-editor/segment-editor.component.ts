import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RopeSegment, RiskLevel, RISK_LEVEL_MAP, CaveNode, TraversalDirection } from '../../models/cave-graph.model';

@Component({
  selector: 'app-segment-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSliderModule,
    MatCheckboxModule
  ],
  template: `
    <mat-card class="segment-editor">
      <mat-card-header>
        <mat-card-title>{{ isEditing ? '编辑绳段' : '添加绳段' }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="segmentForm" (ngSubmit)="onSubmit()">
          <div class="node-selectors">
            <mat-form-field appearance="fill" class="half-width">
              <mat-label>起点节点</mat-label>
              <mat-select formControlName="sourceId">
                <mat-option *ngFor="let node of nodes" [value]="node.id">
                  {{ node.name }} ({{ node.id }})
                </mat-option>
              </mat-select>
              <mat-error *ngIf="segmentForm.get('sourceId')?.hasError('required')">
                请选择起点
              </mat-error>
            </mat-form-field>

            <mat-icon class="arrow-icon">arrow_forward</mat-icon>

            <mat-form-field appearance="fill" class="half-width">
              <mat-label>终点节点</mat-label>
              <mat-select formControlName="targetId">
                <mat-option *ngFor="let node of nodes" [value]="node.id">
                  {{ node.name }} ({{ node.id }})
                </mat-option>
              </mat-select>
              <mat-error *ngIf="segmentForm.get('targetId')?.hasError('required')">
                请选择终点
              </mat-error>
              <mat-error *ngIf="segmentForm.get('targetId')?.hasError('sameNode')">
                起点和终点不能相同
              </mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>绳段长度 (米)</mat-label>
            <input matInput type="number" formControlName="length" min="0.1" step="0.1">
            <mat-error *ngIf="segmentForm.get('length')?.hasError('required')">
              长度不能为空
            </mat-error>
            <mat-error *ngIf="segmentForm.get('length')?.hasError('min') || segmentForm.get('length')?.hasError('pattern')">
              绳段长度必须大于零
            </mat-error>
          </mat-form-field>

          <div class="slider-field">
            <label>坡度 (度): {{ segmentForm.get('slope')?.value }}°</label>
            <mat-slider min="-90" max="90" step="1" discrete>
              <input matSliderThumb formControlName="slope">
            </mat-slider>
          </div>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>承重上限 (千克)</mat-label>
            <input matInput type="number" formControlName="maxLoad" min="1" step="1">
            <mat-error *ngIf="segmentForm.get('maxLoad')?.hasError('required')">
              承重上限不能为空
            </mat-error>
            <mat-error *ngIf="segmentForm.get('maxLoad')?.hasError('min')">
              承重上限必须大于零
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>风险等级</mat-label>
            <mat-select formControlName="riskLevel">
              <mat-option *ngFor="let level of riskLevels" [value]="level.value">
                <span class="risk-indicator" [style.backgroundColor]="level.color"></span>
                {{ level.label }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>通行方向</mat-label>
            <mat-select formControlName="traversalDirection">
              <mat-option value="bidirectional">双向通行</mat-option>
              <mat-option value="sourceToTarget">仅起点→终点</mat-option>
              <mat-option value="targetToSource">仅终点→起点</mat-option>
            </mat-select>
            <mat-hint>设置绳段的通行方向限制</mat-hint>
          </mat-form-field>

          <div class="block-toggle">
            <mat-checkbox formControlName="isBlocked">
              <span class="block-label">临时封锁此绳段</span>
            </mat-checkbox>
            <span class="block-hint">封锁后该绳段在路径计算中将被忽略</span>
          </div>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>描述</mat-label>
            <textarea matInput formControlName="description" rows="2"></textarea>
          </mat-form-field>

          <div class="form-actions">
            <button type="button" mat-button (click)="onCancel()" *ngIf="isEditing">
              取消
            </button>
            <button type="button" mat-button color="warn" (click)="onDelete()" *ngIf="isEditing">
              <mat-icon>delete</mat-icon>
              删除
            </button>
            <button type="submit" mat-raised-button color="primary" [disabled]="!segmentForm.valid">
              {{ isEditing ? '保存' : '添加' }}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .segment-editor {
      margin: 8px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .node-selectors {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .half-width {
      flex: 1;
    }
    .arrow-icon {
      color: #888;
    }
    .slider-field {
      margin: 8px 0 16px 0;
    }
    .slider-field label {
      display: block;
      margin-bottom: 8px;
      color: rgba(0, 0, 0, 0.6);
      font-size: 12px;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .risk-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }
    .block-toggle {
      margin: 12px 0;
      padding: 12px;
      background: rgba(244, 67, 54, 0.08);
      border-radius: 8px;
      border-left: 4px solid #f44336;
    }
    .block-label {
      font-weight: 500;
      color: #d32f2f;
    }
    .block-hint {
      display: block;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
      margin-top: 4px;
      margin-left: 28px;
    }
  `]
})
export class SegmentEditorComponent implements OnInit, OnChanges {
  @Input() segment: RopeSegment | null = null;
  @Input() nodes: CaveNode[] = [];
  @Input() preselectedSourceId: string | null = null;
  @Input() preselectedTargetId: string | null = null;

  @Output() save = new EventEmitter<RopeSegment>();
  @Output() delete = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  segmentForm!: FormGroup;

  riskLevels = Object.entries(RISK_LEVEL_MAP).map(([value, info]) => ({
    value: value as RiskLevel,
    label: info.label,
    color: info.color
  }));

  constructor(private fb: FormBuilder) {
    this.createForm();
  }

  ngOnInit(): void {
    this.updateForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['segment']) {
      this.updateForm();
    }
    if (changes['preselectedSourceId'] && !this.isEditing) {
      this.segmentForm.patchValue({ sourceId: this.preselectedSourceId });
    }
    if (changes['preselectedTargetId'] && !this.isEditing) {
      this.segmentForm.patchValue({ targetId: this.preselectedTargetId });
    }
  }

  get isEditing(): boolean {
    return this.segment !== null;
  }

  private createForm(): void {
    this.segmentForm = this.fb.group({
      sourceId: ['', [Validators.required]],
      targetId: ['', [Validators.required]],
      length: [10, [Validators.required, Validators.min(0.1)]],
      slope: [0],
      maxLoad: [200, [Validators.required, Validators.min(1)]],
      riskLevel: ['medium' as RiskLevel, [Validators.required]],
      traversalDirection: ['bidirectional' as TraversalDirection, [Validators.required]],
      isBlocked: [false],
      description: ['']
    }, { validators: this.sameNodeValidator });
  }

  private sameNodeValidator(group: FormGroup): { [key: string]: boolean } | null {
    const sourceId = group.get('sourceId')?.value;
    const targetId = group.get('targetId')?.value;
    if (sourceId && targetId && sourceId === targetId) {
      const targetControl = group.get('targetId');
      if (targetControl) {
        targetControl.setErrors({ sameNode: true });
      }
      return { sameNode: true };
    }
    return null;
  }

  private updateForm(): void {
    if (this.segment) {
      this.segmentForm.patchValue({
        sourceId: this.segment.sourceId,
        targetId: this.segment.targetId,
        length: this.segment.length,
        slope: this.segment.slope,
        maxLoad: this.segment.maxLoad,
        riskLevel: this.segment.riskLevel,
        traversalDirection: this.segment.traversalDirection || 'bidirectional',
        isBlocked: this.segment.isBlocked || false,
        description: this.segment.description || ''
      });
    } else {
      this.segmentForm.reset({
        sourceId: this.preselectedSourceId || '',
        targetId: this.preselectedTargetId || '',
        length: 10,
        slope: 0,
        maxLoad: 200,
        riskLevel: 'medium',
        traversalDirection: 'bidirectional',
        isBlocked: false,
        description: ''
      });
    }
  }

  onSubmit(): void {
    if (!this.segmentForm.valid) return;

    const formValue = this.segmentForm.value;
    const segment: RopeSegment = {
      id: this.segment?.id || '',
      sourceId: formValue.sourceId,
      targetId: formValue.targetId,
      length: parseFloat(formValue.length),
      slope: parseFloat(formValue.slope),
      maxLoad: parseFloat(formValue.maxLoad),
      riskLevel: formValue.riskLevel,
      traversalDirection: formValue.traversalDirection as TraversalDirection,
      isBlocked: formValue.isBlocked || false,
      description: formValue.description || undefined
    };

    this.save.emit(segment);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onDelete(): void {
    if (this.segment) {
      this.delete.emit(this.segment.id);
    }
  }
}
