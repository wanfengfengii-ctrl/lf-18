import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { TeamConfig, TeamMember } from '../../models/cave-graph.model';

@Component({
  selector: 'app-team-config',
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
    MatDividerModule,
    MatSliderModule
  ],
  template: `
    <mat-card class="team-config">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>groups</mat-icon>
          队伍配置
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="teamForm">
          <div class="section-title">
            <span>队员列表</span>
            <button mat-icon-button color="primary" (click)="addMember()" type="button">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <div formArrayName="members" class="members-list">
            <div
              *ngFor="let memberForm of membersFormArray.controls; let i = index"
              [formGroupName]="i"
              class="member-item"
            >
              <div class="member-header">
                <span class="member-order">{{ i + 1 }}</span>
                <span class="member-name" *ngIf="!editingIndex[i]">
                  {{ memberForm.get('name')?.value || '未命名队员' }}
                </span>
                <input
                  *ngIf="editingIndex[i]"
                  formControlName="name"
                  matInput
                  class="name-input"
                  placeholder="姓名"
                />
                <div class="member-actions">
                  <button
                    mat-icon-button
                    type="button"
                    (click)="toggleEdit(i)"
                    [color]="editingIndex[i] ? 'primary' : ''"
                  >
                    <mat-icon>{{ editingIndex[i] ? 'check' : 'edit' }}</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    (click)="moveUp(i)"
                    [disabled]="i === 0"
                  >
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    (click)="moveDown(i)"
                    [disabled]="i === membersFormArray.length - 1"
                  >
                    <mat-icon>arrow_downward</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    color="warn"
                    type="button"
                    (click)="removeMember(i)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="member-details" *ngIf="editingIndex[i]">
                <mat-form-field appearance="fill" class="detail-field">
                  <mat-label>体重 (kg)</mat-label>
                  <input matInput type="number" formControlName="weight" min="0" step="0.1" />
                  <mat-error *ngIf="memberForm.get('weight')?.hasError('required')">
                    请输入体重
                  </mat-error>
                  <mat-error *ngIf="memberForm.get('weight')?.hasError('min')">
                    体重不能为负数
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="fill" class="detail-field">
                  <mat-label>装备重量 (kg)</mat-label>
                  <input matInput type="number" formControlName="equipmentWeight" min="0" step="0.1" />
                  <mat-error *ngIf="memberForm.get('equipmentWeight')?.hasError('required')">
                    请输入装备重量
                  </mat-error>
                  <mat-error *ngIf="memberForm.get('equipmentWeight')?.hasError('min')">
                    装备重量不能为负数
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="member-summary" *ngIf="!editingIndex[i]">
                <span>体重: {{ memberForm.get('weight')?.value }} kg</span>
                <span>装备: {{ memberForm.get('equipmentWeight')?.value }} kg</span>
                <span class="total-weight">
                  总负重: {{ (memberForm.get('weight')?.value || 0) + (memberForm.get('equipmentWeight')?.value || 0) }} kg
                </span>
              </div>
            </div>
          </div>

          <div class="empty-state" *ngIf="membersFormArray.length === 0">
            <mat-icon class="empty-icon">person_outline</mat-icon>
            <p>暂无队员，点击上方 + 添加队员</p>
          </div>

          <mat-divider></mat-divider>

          <div class="safety-section">
            <div class="section-title">
              <span>安全系数</span>
              <span class="safety-value">{{ safetyFactor.toFixed(1) }}</span>
            </div>
            <mat-slider
              min="1"
              max="5"
              step="0.1"
              discrete
              showTickMarks
              formControlName="safetyFactor"
            >
              <input matSliderThumb />
            </mat-slider>
            <p class="safety-hint">安全系数越高，计算的安全负重越大</p>
          </div>

          <mat-divider></mat-divider>

          <div class="stats-section">
            <div class="section-title">
              <span>队伍统计</span>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">总人数</span>
                <span class="stat-value">{{ totalMembers }} 人</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总体重</span>
                <span class="stat-value">{{ totalWeight.toFixed(1) }} kg</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总装备重</span>
                <span class="stat-value">{{ totalEquipmentWeight.toFixed(1) }} kg</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总负重</span>
                <span class="stat-value">{{ totalLoad.toFixed(1) }} kg</span>
              </div>
              <div class="stat-item highlight">
                <span class="stat-label">含安全系数总负重</span>
                <span class="stat-value">{{ safetyAdjustedLoad.toFixed(1) }} kg</span>
              </div>
            </div>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .team-config {
      margin: 8px;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
      font-size: 14px;
      margin: 16px 0 12px 0;
      color: rgba(0, 0, 0, 0.87);
    }
    .members-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .member-item {
      padding: 12px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
    }
    .member-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .member-order {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1976d2;
      color: white;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .member-name {
      flex: 1;
      font-weight: 500;
    }
    .name-input {
      flex: 1;
      border: none;
      border-bottom: 1px solid #1976d2;
      outline: none;
      font-size: 14px;
      padding: 4px 0;
      background: transparent;
    }
    .member-actions {
      display: flex;
      gap: 4px;
    }
    .member-details {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      padding-left: 40px;
    }
    .detail-field {
      flex: 1;
    }
    .member-summary {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      padding-left: 40px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .total-weight {
      color: #1976d2;
      font-weight: 500;
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
    .safety-section {
      margin: 16px 0;
    }
    .safety-value {
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }
    .safety-hint {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
      margin: 8px 0 0 0;
    }
    .stats-section {
      margin-top: 16px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      padding: 12px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
    }
    .stat-item.highlight {
      background: rgba(25, 118, 210, 0.1);
      grid-column: span 2;
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
    ::ng-deep .mdc-slider {
      width: 100%;
    }
  `]
})
export class TeamConfigComponent implements OnInit, OnChanges {
  @Input() config: TeamConfig | null = null;

  @Output() configChange = new EventEmitter<TeamConfig>();

  teamForm!: FormGroup;
  editingIndex: boolean[] = [];

  constructor(private fb: FormBuilder) {
    this.createForm();
  }

  ngOnInit(): void {
    if (this.config) {
      this.updateFormFromConfig(this.config);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].isFirstChange()) {
      this.updateFormFromConfig(this.config!);
    }
  }

  get membersFormArray(): FormArray {
    return this.teamForm.get('members') as FormArray;
  }

  get safetyFactor(): number {
    return this.teamForm.get('safetyFactor')?.value ?? 1;
  }

  get totalMembers(): number {
    return this.membersFormArray.length;
  }

  get totalWeight(): number {
    return this.membersFormArray.controls.reduce(
      (sum, member) => sum + (member.get('weight')?.value || 0),
      0
    );
  }

  get totalEquipmentWeight(): number {
    return this.membersFormArray.controls.reduce(
      (sum, member) => sum + (member.get('equipmentWeight')?.value || 0),
      0
    );
  }

  get totalLoad(): number {
    return this.totalWeight + this.totalEquipmentWeight;
  }

  get safetyAdjustedLoad(): number {
    return this.totalLoad * this.safetyFactor;
  }

  private createForm(): void {
    this.teamForm = this.fb.group({
      members: this.fb.array([]),
      safetyFactor: [1.5, [Validators.required, Validators.min(1), Validators.max(5)]]
    });

    this.teamForm.valueChanges.subscribe(() => {
      this.emitConfig();
    });
  }

  private updateFormFromConfig(config: TeamConfig): void {
    const membersFormArray = this.membersFormArray;
    membersFormArray.clear();

    config.members.forEach((member) => {
      membersFormArray.push(this.createMemberFormGroup(member));
    });

    this.editingIndex = new Array(config.members.length).fill(false);

    this.teamForm.patchValue({
      safetyFactor: config.safetyFactor
    });
  }

  private createMemberFormGroup(member?: TeamMember): FormGroup {
    return this.fb.group({
      id: [member?.id || this.generateId()],
      name: [member?.name || '', Validators.required],
      weight: [member?.weight ?? 60, [Validators.required, Validators.min(0)]],
      equipmentWeight: [member?.equipmentWeight ?? 10, [Validators.required, Validators.min(0)]]
    });
  }

  private generateId(): string {
    return 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  addMember(): void {
    const newMember = this.createMemberFormGroup();
    this.membersFormArray.push(newMember);
    this.editingIndex.push(true);
  }

  removeMember(index: number): void {
    this.membersFormArray.removeAt(index);
    this.editingIndex.splice(index, 1);
  }

  toggleEdit(index: number): void {
    this.editingIndex[index] = !this.editingIndex[index];
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const members = this.membersFormArray;
    const member = members.at(index);
    members.removeAt(index);
    members.insert(index - 1, member);

    const editing = this.editingIndex[index];
    this.editingIndex.splice(index, 1);
    this.editingIndex.splice(index - 1, 0, editing);
  }

  moveDown(index: number): void {
    if (index === this.membersFormArray.length - 1) return;
    const members = this.membersFormArray;
    const member = members.at(index);
    members.removeAt(index);
    members.insert(index + 1, member);

    const editing = this.editingIndex[index];
    this.editingIndex.splice(index, 1);
    this.editingIndex.splice(index + 1, 0, editing);
  }

  private emitConfig(): void {
    const formValue = this.teamForm.value;
    const members: TeamMember[] = formValue.members.map((m: any) => ({
      id: m.id,
      name: m.name,
      weight: parseFloat(m.weight) || 0,
      equipmentWeight: parseFloat(m.equipmentWeight) || 0
    }));

    const config: TeamConfig = {
      members,
      passingOrder: members.map(m => m.id),
      safetyFactor: parseFloat(formValue.safetyFactor) || 1
    };

    this.configChange.emit(config);
  }
}
