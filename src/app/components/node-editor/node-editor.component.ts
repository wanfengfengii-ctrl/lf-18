import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CaveNode, NodeType, NODE_TYPE_MAP } from '../../models/cave-graph.model';

@Component({
  selector: 'app-node-editor',
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
    MatCheckboxModule
  ],
  template: `
    <mat-card class="node-editor">
      <mat-card-header>
        <mat-card-title>{{ isEditing ? '编辑节点' : '添加节点' }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="nodeForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="fill" class="full-width">
            <mat-label>节点编号</mat-label>
            <input matInput formControlName="id" [readonly]="isEditing">
            <mat-error *ngIf="nodeForm.get('id')?.hasError('required')">
              节点编号不能为空
            </mat-error>
            <mat-error *ngIf="nodeForm.get('id')?.hasError('duplicate')">
              节点编号已存在，不能重复
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>节点名称</mat-label>
            <input matInput formControlName="name">
            <mat-error *ngIf="nodeForm.get('name')?.hasError('required')">
              节点名称不能为空
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>节点类型</mat-label>
            <mat-select formControlName="type" (selectionChange)="onTypeChange()">
              <mat-option *ngFor="let type of nodeTypes" [value]="type.value">
                <span class="type-dot" [style.backgroundColor]="type.color"></span>
                {{ type.label }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width" *ngIf="nodeForm.get('type')?.value === 'anchor'">
            <mat-label>锚点承重上限 (千克)</mat-label>
            <input matInput type="number" formControlName="maxLoad" min="1" step="1">
            <mat-hint>该锚点能够承受的最大总负载</mat-hint>
            <mat-error *ngIf="nodeForm.get('maxLoad')?.hasError('required')">
              锚点必须填写承重上限
            </mat-error>
            <mat-error *ngIf="nodeForm.get('maxLoad')?.hasError('min')">
              承重上限必须大于零
            </mat-error>
          </mat-form-field>

          <div class="block-toggle" *ngIf="isEditing">
            <mat-checkbox formControlName="isBlocked">
              <span class="block-label">临时封锁此节点</span>
            </mat-checkbox>
            <span class="block-hint">封锁后该节点在路径计算中将被忽略</span>
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
            <button type="submit" mat-raised-button color="primary" [disabled]="!nodeForm.valid">
              {{ isEditing ? '保存' : '添加' }}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .node-editor {
      margin: 8px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .type-dot {
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
export class NodeEditorComponent implements OnInit, OnChanges {
  @Input() node: CaveNode | null = null;
  @Input() existingIds: string[] = [];
  @Input() defaultPosition: { x: number; y: number } = { x: 100, y: 100 };

  @Output() save = new EventEmitter<CaveNode>();
  @Output() delete = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  nodeForm!: FormGroup;

  nodeTypes = Object.entries(NODE_TYPE_MAP).map(([value, info]) => ({
    value: value as NodeType,
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
    if (changes['node']) {
      this.updateForm();
    }
  }

  get isEditing(): boolean {
    return this.node !== null;
  }

  private createForm(): void {
    this.nodeForm = this.fb.group({
      id: ['', [Validators.required]],
      name: ['', [Validators.required]],
      type: ['platform' as NodeType, [Validators.required]],
      maxLoad: [null],
      isBlocked: [false],
      description: [''],
      x: [0],
      y: [0]
    });
  }

  private updateForm(): void {
    if (this.node) {
      this.nodeForm.patchValue({
        id: this.node.id,
        name: this.node.name,
        type: this.node.type,
        maxLoad: this.node.maxLoad ?? null,
        isBlocked: this.node.isBlocked || false,
        description: this.node.description || '',
        x: this.node.x,
        y: this.node.y
      });
    } else {
      this.nodeForm.reset({
        id: '',
        name: '',
        type: 'platform',
        maxLoad: null,
        isBlocked: false,
        description: '',
        x: this.defaultPosition.x,
        y: this.defaultPosition.y
      });
    }
    this.updateIdValidator();
    this.updateMaxLoadValidator();
  }

  onTypeChange(): void {
    this.updateMaxLoadValidator();
  }

  private updateMaxLoadValidator(): void {
    const maxLoadControl = this.nodeForm.get('maxLoad');
    const typeControl = this.nodeForm.get('type');
    if (!maxLoadControl || !typeControl) return;

    if (typeControl.value === 'anchor') {
      maxLoadControl.setValidators([Validators.required, Validators.min(1)]);
      if (!maxLoadControl.value) {
        maxLoadControl.setValue(200);
      }
    } else {
      maxLoadControl.clearValidators();
      maxLoadControl.setValue(null);
    }
    maxLoadControl.updateValueAndValidity();
  }

  private updateIdValidator(): void {
    const idControl = this.nodeForm.get('id');
    if (!idControl) return;

    idControl.setValidators([
      Validators.required,
      (control) => {
        const value = control.value;
        if (!value) return null;
        if (this.isEditing && this.node?.id === value) return null;
        if (this.existingIds.includes(value)) {
          return { duplicate: true };
        }
        return null;
      }
    ]);
    idControl.updateValueAndValidity();
  }

  onSubmit(): void {
    if (!this.nodeForm.valid) return;

    const formValue = this.nodeForm.value;
    const node: CaveNode = {
      id: formValue.id,
      name: formValue.name,
      type: formValue.type,
      maxLoad: formValue.type === 'anchor' ? parseFloat(formValue.maxLoad) : undefined,
      isBlocked: formValue.isBlocked || false,
      description: formValue.description || undefined,
      x: formValue.x,
      y: formValue.y
    };

    this.save.emit(node);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onDelete(): void {
    if (this.node) {
      this.delete.emit(this.node.id);
    }
  }
}
