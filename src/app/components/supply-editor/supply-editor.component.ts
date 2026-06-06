import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {
  SupplyItem,
  SupplyType,
  SupplyPriority,
  SUPPLY_TYPE_MAP,
  SUPPLY_PRIORITY_MAP
} from '../../models/cave-graph.model';

@Component({
  selector: 'app-supply-editor',
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
    MatListModule,
    MatDividerModule,
    MatExpansionModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <mat-card class="supply-editor">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>inventory_2</mat-icon>
          物资库存管理
        </mat-card-title>
        <mat-card-subtitle>
          {{ nodeName || '未选择节点' }}
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="total-weight" *ngIf="supplies.length > 0">
          <span class="weight-label">物资总重量</span>
          <span class="weight-value">{{ totalWeight.toFixed(2) }} kg</span>
        </div>

        <div class="supply-list" *ngIf="supplies.length > 0">
          <mat-accordion>
            <mat-expansion-panel *ngFor="let item of supplies; let i = index" [expanded]="i === 0">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <span class="supply-icon" [style.color]="getSupplyColor(item.type)">
                    <mat-icon>{{ getSupplyIcon(item.type) }}</mat-icon>
                  </span>
                  {{ getSupplyLabel(item.type) }}
                  <span class="quantity-badge">{{ item.quantity }} 单位</span>
                </mat-panel-title>
                <mat-panel-description>
                  <span class="priority-tag" [ngClass]="'priority-' + item.priority">
                    {{ getPriorityLabel(item.priority) }}
                  </span>
                </mat-panel-description>
              </mat-expansion-panel-header>
              <div class="supply-details">
                <div class="detail-row">
                  <span class="detail-label">数量</span>
                  <span class="detail-value">{{ item.quantity }} 单位</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">单位重量</span>
                  <span class="detail-value">{{ item.unitWeight }} kg</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">总重量</span>
                  <span class="detail-value">{{ (item.quantity * item.unitWeight).toFixed(2) }} kg</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">最低安全库存</span>
                  <span class="detail-value">{{ item.minSafetyStock }} 单位</span>
                </div>
                <div class="detail-row" *ngIf="item.expirationDate">
                  <span class="detail-label">有效期至</span>
                  <span class="detail-value">{{ formatDate(item.expirationDate) }}</span>
                </div>
                <div class="detail-row" *ngIf="item.notes">
                  <span class="detail-label">备注</span>
                  <span class="detail-value">{{ item.notes }}</span>
                </div>
                <div class="detail-actions">
                  <button mat-button color="primary" (click)="onEditItem(i)">
                    <mat-icon>edit</mat-icon>
                    编辑
                  </button>
                  <button mat-button color="warn" (click)="onRemoveItem(item.type)">
                    <mat-icon>delete</mat-icon>
                    删除
                  </button>
                </div>
              </div>
            </mat-expansion-panel>
          </mat-accordion>
        </div>

        <div class="empty-state" *ngIf="supplies.length === 0 && !isAdding">
          <mat-icon class="empty-icon">inventory</mat-icon>
          <p>暂无物资库存</p>
        </div>

        <mat-divider></mat-divider>

        <div class="add-section">
          <button mat-raised-button color="primary" (click)="toggleAddForm()" *ngIf="!isAdding">
            <mat-icon>add</mat-icon>
            添加物资
          </button>

          <div class="add-form" *ngIf="isAdding">
            <h4 class="form-title">{{ editingIndex !== null ? '编辑物资' : '添加物资' }}</h4>
            <form [formGroup]="supplyForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="fill" class="full-width">
                <mat-label>物资类型</mat-label>
                <mat-select formControlName="type">
                  <mat-option *ngFor="let type of availableSupplyTypes" [value]="type.value">
                    <span class="type-icon" [style.color]="type.color">
                      <mat-icon>{{ type.icon }}</mat-icon>
                    </span>
                    {{ type.label }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="fill" class="half-width">
                  <mat-label>数量</mat-label>
                  <input matInput type="number" formControlName="quantity" min="0" step="1">
                  <mat-error *ngIf="supplyForm.get('quantity')?.hasError('required')">
                    请输入数量
                  </mat-error>
                  <mat-error *ngIf="supplyForm.get('quantity')?.hasError('min')">
                    数量不能小于0
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="fill" class="half-width">
                  <mat-label>单位重量 (kg)</mat-label>
                  <input matInput type="number" formControlName="unitWeight" min="0" step="0.1">
                  <mat-error *ngIf="supplyForm.get('unitWeight')?.hasError('required')">
                    请输入单位重量
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="fill" class="half-width">
                  <mat-label>最低安全库存</mat-label>
                  <input matInput type="number" formControlName="minSafetyStock" min="0" step="1">
                </mat-form-field>

                <mat-form-field appearance="fill" class="half-width">
                  <mat-label>优先级</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option *ngFor="let prio of priorityOptions" [value]="prio.value">
                      <span class="priority-dot" [style.backgroundColor]="prio.color"></span>
                      {{ prio.label }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="fill" class="full-width">
                <mat-label>备注</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <div class="form-actions">
                <button type="button" mat-button (click)="cancelAdd()">
                  取消
                </button>
                <button type="submit" mat-raised-button color="primary" [disabled]="!supplyForm.valid">
                  {{ editingIndex !== null ? '保存' : '添加' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .supply-editor {
      margin: 8px;
    }
    .total-weight {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0, 188, 212, 0.1);
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .weight-label {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
    }
    .weight-value {
      font-size: 18px;
      font-weight: 600;
      color: #00bcd4;
    }
    .supply-list {
      margin-bottom: 16px;
    }
    .supply-icon {
      margin-right: 8px;
      font-size: 20px;
    }
    .quantity-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
    }
    .priority-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    .priority-critical { background: #f44336; }
    .priority-high { background: #ff9800; }
    .priority-medium { background: #ffeb3b; color: #333; }
    .priority-low { background: #4caf50; }
    .supply-details {
      padding: 8px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    .detail-label {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }
    .detail-value {
      font-size: 13px;
      font-weight: 500;
    }
    .detail-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      justify-content: flex-end;
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
    .add-section {
      margin-top: 12px;
    }
    .add-form {
      margin-top: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 8px;
    }
    .form-title {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .form-row {
      display: flex;
      gap: 8px;
    }
    .half-width {
      flex: 1;
    }
    .type-icon {
      margin-right: 8px;
      font-size: 18px;
      vertical-align: middle;
    }
    .priority-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `]
})
export class SupplyEditorComponent implements OnInit, OnChanges {
  @Input() supplies: SupplyItem[] = [];
  @Input() nodeName: string = '';
  @Input() nodeId: string = '';

  @Output() save = new EventEmitter<SupplyItem[]>();
  @Output() cancel = new EventEmitter<void>();

  supplyForm!: FormGroup;
  isAdding = false;
  editingIndex: number | null = null;

  readonly supplyTypes = Object.entries(SUPPLY_TYPE_MAP).map(([value, info]) => ({
    value: value as SupplyType,
    label: info.label,
    icon: info.icon,
    color: info.color,
    defaultUnitWeight: info.defaultUnitWeight,
    defaultMinStock: info.defaultMinStock,
    defaultPriority: info.defaultPriority
  }));

  readonly priorityOptions = Object.entries(SUPPLY_PRIORITY_MAP).map(([value, info]) => ({
    value: value as SupplyPriority,
    label: info.label,
    color: info.color
  }));

  constructor(private fb: FormBuilder) {
    this.createForm();
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['supplies']) {
      this.resetForm();
    }
  }

  get availableSupplyTypes(): typeof this.supplyTypes {
    const existingTypes = new Set(this.supplies.map(s => s.type));
    if (this.editingIndex !== null) {
      return this.supplyTypes;
    }
    return this.supplyTypes.filter(t => !existingTypes.has(t.value));
  }

  get totalWeight(): number {
    return this.supplies.reduce((sum, s) => sum + s.quantity * s.unitWeight, 0);
  }

  private createForm(): void {
    this.supplyForm = this.fb.group({
      type: ['oxygen' as SupplyType, Validators.required],
      quantity: [0, [Validators.required, Validators.min(0)]],
      unitWeight: [0, [Validators.required, Validators.min(0)]],
      minSafetyStock: [0, Validators.min(0)],
      priority: ['medium' as SupplyPriority, Validators.required],
      expirationDate: [null],
      notes: ['']
    });
  }

  getSupplyLabel(type: SupplyType): string {
    return SUPPLY_TYPE_MAP[type]?.label || type;
  }

  getSupplyIcon(type: SupplyType): string {
    return SUPPLY_TYPE_MAP[type]?.icon || 'inventory_2';
  }

  getSupplyColor(type: SupplyType): string {
    return SUPPLY_TYPE_MAP[type]?.color || '#999';
  }

  getPriorityLabel(priority: SupplyPriority): string {
    return SUPPLY_PRIORITY_MAP[priority]?.label || priority;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }

  toggleAddForm(): void {
    this.isAdding = !this.isAdding;
    this.editingIndex = null;
    if (this.isAdding) {
      this.resetForm();
      const firstAvailable = this.availableSupplyTypes[0];
      if (firstAvailable) {
        this.supplyForm.patchValue({
          type: firstAvailable.value,
          unitWeight: firstAvailable.defaultUnitWeight,
          minSafetyStock: firstAvailable.defaultMinStock,
          priority: firstAvailable.defaultPriority
        });
      }
    }
  }

  onEditItem(index: number): void {
    const item = this.supplies[index];
    this.editingIndex = index;
    this.isAdding = true;
    this.supplyForm.patchValue({
      type: item.type,
      quantity: item.quantity,
      unitWeight: item.unitWeight,
      minSafetyStock: item.minSafetyStock,
      priority: item.priority,
      expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
      notes: item.notes || ''
    });
  }

  onRemoveItem(type: SupplyType): void {
    if (confirm(`确定要删除 ${this.getSupplyLabel(type)} 吗？`)) {
      const updated = this.supplies.filter(s => s.type !== type);
      this.save.emit(updated);
    }
  }

  cancelAdd(): void {
    this.isAdding = false;
    this.editingIndex = null;
    this.resetForm();
  }

  private resetForm(): void {
    this.supplyForm.reset({
      type: 'oxygen',
      quantity: 0,
      unitWeight: 5,
      minSafetyStock: 2,
      priority: 'critical',
      expirationDate: null,
      notes: ''
    });
  }

  onSubmit(): void {
    if (!this.supplyForm.valid) return;

    const formValue = this.supplyForm.value;
    const newItem: SupplyItem = {
      type: formValue.type,
      quantity: parseFloat(formValue.quantity) || 0,
      unitWeight: parseFloat(formValue.unitWeight) || 0,
      minSafetyStock: parseFloat(formValue.minSafetyStock) || 0,
      priority: formValue.priority,
      expirationDate: formValue.expirationDate ? formValue.expirationDate.getTime() : undefined,
      notes: formValue.notes || undefined
    };

    let updated: SupplyItem[];
    if (this.editingIndex !== null) {
      updated = [...this.supplies];
      updated[this.editingIndex] = newItem;
    } else {
      updated = [...this.supplies, newItem];
    }

    this.save.emit(updated);
    this.isAdding = false;
    this.editingIndex = null;
    this.resetForm();
  }
}
