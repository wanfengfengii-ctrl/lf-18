import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import {
  SupplyAnalysis,
  NodeSupplyAssessment,
  SupplyPlacementRecommendation,
  EmergencySupplyRoute,
  SupplyType,
  SupplyConsumptionRate,
  SUPPLY_TYPE_MAP,
  SUPPLY_ADEQUACY_MAP,
  SUPPLY_PRIORITY_MAP,
  DEFAULT_CONSUMPTION_RATES
} from '../../models/cave-graph.model';

@Component({
  selector: 'app-supply-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatDividerModule,
    MatExpansionModule,
    MatInputModule,
    MatFormFieldModule
  ],
  template: `
    <mat-card class="supply-panel">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>inventory_2</mat-icon>
          物资与补给
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">补给站数量</span>
            <span class="stat-value supply">{{ totalSupplyNodes }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总重量</span>
            <span class="stat-value">{{ totalSuppliesWeight.toFixed(1) }} kg</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">不足节点</span>
            <span class="stat-value deficit">{{ deficitCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">严重不足</span>
            <span class="stat-value critical">{{ criticalCount }}</span>
          </div>
        </div>

        <div class="settings-section">
          <h4 class="section-title">
            <mat-icon>settings</mat-icon>
            消耗参数设置
          </h4>
          <div class="duration-input">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>预计任务时长 (小时)</mat-label>
              <input matInput type="number" 
                     [value]="estimatedDurationHours" 
                     (change)="onDurationChange($event)"
                     min="1" step="1">
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <mat-accordion class="supply-accordion">
          <mat-expansion-panel expanded="true">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>assessment</mat-icon>
                补给充足性评估
              </mat-panel-title>
              <mat-panel-description>
                {{ supplyAssessments.length }} 个节点
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let assessment of supplyAssessments" 
                             class="assessment-item"
                             (click)="onNodeClick(assessment.nodeId)">
                <span matListItemTitle class="assessment-name">
                  {{ assessment.nodeName }}
                  <span class="level-badge" 
                        [ngClass]="'level-' + assessment.overallLevel">
                    {{ getLevelLabel(assessment.overallLevel) }}
                  </span>
                </span>
                <span matListItemLine class="assessment-sub">
                  物资总重: {{ assessment.totalSuppliesWeight.toFixed(1) }} kg
                  <span *ngIf="assessment.nearestSupplyPoint && assessment.nearestSupplyPoint !== assessment.nodeId">
                    · 最近补给: {{ getSupplyNodeName(assessment.nearestSupplyPoint) }} ({{ assessment.distanceToSupply.toFixed(0) }}m)
                  </span>
                </span>
                <span matListItemLine class="supply-items-bar">
                  <span *ngFor="let item of assessment.adequacyItems" 
                        class="supply-item-dot"
                        [title]="getSupplyItemTooltip(item)"
                        [style.backgroundColor]="getSupplyColor(item.type)">
                  </span>
                </span>
              </mat-list-item>
            </mat-list>
            <div class="empty-hint" *ngIf="supplyAssessments.length === 0">
              暂无评估数据
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel expanded="true" *ngIf="placementRecommendations.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="recommend-icon">star</mat-icon>
                推荐布设点
              </mat-panel-title>
              <mat-panel-description>
                {{ placementRecommendations.length }} 个推荐
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let rec of placementRecommendations" 
                             class="recommendation-item"
                             (click)="onNodeClick(rec.nodeId)">
                <span matListItemTitle class="rec-name">
                  <span class="rec-score">{{ rec.score }}分</span>
                  {{ rec.nodeName }}
                </span>
                <span matListItemLine class="rec-reason">{{ rec.reason }}</span>
                <span matListItemLine class="rec-coverage">
                  覆盖节点: {{ rec.coverageNodes.length }} 个
                </span>
                <button mat-icon-button size="small" 
                        class="add-supply-btn"
                        (click)="$event.stopPropagation(); onAddSupply(rec)"
                        title="快速添加补给">
                  <mat-icon>add_location</mat-icon>
                </button>
              </mat-list-item>
            </mat-list>
          </mat-expansion-panel>

          <mat-expansion-panel expanded="true" *ngIf="emergencyRoutes.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="emergency-icon">emergency</mat-icon>
                应急补给路线
              </mat-panel-title>
              <mat-panel-description>
                {{ emergencyRoutes.length }} 条路线
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let route of emergencyRoutes" 
                             class="route-item"
                             (click)="onRouteClick(route)">
                <span matListItemTitle class="route-name">
                  {{ getNodeName(route.fromNodeId) }} → {{ getNodeName(route.toSupplyNodeId) }}
                </span>
                <span matListItemLine class="route-info">
                  距离: {{ route.totalLength.toFixed(1) }}m · 
                  风险: {{ getRiskLabel(route.maxRisk) }}
                </span>
              </mat-list-item>
            </mat-list>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>speed</mat-icon>
                人均消耗速率
              </mat-panel-title>
              <mat-panel-description>
                单位/人/小时
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="consumption-list">
              <div *ngFor="let rate of consumptionRates" class="consumption-item">
                <span class="consumption-icon" [style.color]="getSupplyColor(rate.type)">
                  <mat-icon>{{ getSupplyIcon(rate.type) }}</mat-icon>
                </span>
                <span class="consumption-name">{{ getSupplyLabel(rate.type) }}</span>
                <mat-form-field appearance="fill" class="consumption-input">
                  <input matInput type="number" 
                         [value]="rate.perPersonPerHour" 
                         (change)="onRateChange(rate.type, $event)"
                         min="0" step="0.01">
                </mat-form-field>
              </div>
            </div>
            <button mat-button (click)="onResetRates()" class="reset-btn">
              恢复默认值
            </button>
          </mat-expansion-panel>
        </mat-accordion>

        <div class="all-clear" *ngIf="allClear">
          <mat-icon class="check-icon">check_circle</mat-icon>
          <p>所有节点补给充足</p>
        </div>

        <div class="empty-state" *ngIf="!hasData">
          <mat-icon class="empty-icon">inventory</mat-icon>
          <p>暂无补给站数据</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .supply-panel {
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
    .stat-value.supply {
      color: #00bcd4;
    }
    .stat-value.deficit {
      color: #ff9800;
    }
    .stat-value.critical {
      color: #f44336;
    }
    .settings-section {
      margin: 12px 0;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: #333;
    }
    .duration-input {
      margin-bottom: 8px;
    }
    .full-width {
      width: 100%;
    }
    .supply-accordion {
      margin: 8px 0;
    }
    .assessment-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: pointer;
    }
    .assessment-item:hover {
      background: rgba(0, 188, 212, 0.05);
    }
    .assessment-name {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
    }
    .level-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    .level-sufficient { background: #4caf50; }
    .level-warning { background: #ffeb3b; color: #333; }
    .level-deficit { background: #ff9800; }
    .level-critical { background: #f44336; }
    .assessment-sub {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .supply-items-bar {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .supply-item-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .recommend-icon {
      color: #ff9800;
    }
    .recommendation-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: pointer;
      position: relative;
    }
    .recommendation-item:hover {
      background: rgba(255, 152, 0, 0.05);
    }
    .rec-name {
      font-weight: 500;
    }
    .rec-score {
      display: inline-block;
      background: #ff9800;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-right: 8px;
    }
    .rec-reason {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .rec-coverage {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
    }
    .add-supply-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
    }
    .emergency-icon {
      color: #f44336;
    }
    .route-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: pointer;
    }
    .route-item:hover {
      background: rgba(244, 67, 54, 0.05);
    }
    .route-name {
      font-weight: 500;
    }
    .route-info {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .consumption-list {
      padding: 8px 0;
    }
    .consumption-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .consumption-icon {
      font-size: 20px;
    }
    .consumption-name {
      flex: 1;
      font-size: 13px;
    }
    .consumption-input {
      width: 80px;
    }
    .reset-btn {
      width: 100%;
      margin-top: 8px;
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
export class SupplyPanelComponent {
  @Input() supplyAnalysis: SupplyAnalysis | null = null;
  @Input() nodeNames: Record<string, string> = {};

  @Output() nodeClick = new EventEmitter<string>();
  @Output() routeClick = new EventEmitter<EmergencySupplyRoute>();
  @Output() addSupplyPoint = new EventEmitter<SupplyPlacementRecommendation>();
  @Output() consumptionRatesChange = new EventEmitter<SupplyConsumptionRate[]>();
  @Output() durationChange = new EventEmitter<number>();

  get totalSupplyNodes(): number {
    return this.supplyAnalysis?.totalSupplyNodes ?? 0;
  }

  get totalSuppliesWeight(): number {
    return this.supplyAnalysis?.totalSuppliesWeight ?? 0;
  }

  get supplyAssessments(): NodeSupplyAssessment[] {
    return this.supplyAnalysis?.supplyAssessments ?? [];
  }

  get deficitCount(): number {
    return this.supplyAnalysis?.deficitNodes.length ?? 0;
  }

  get criticalCount(): number {
    return this.supplyAnalysis?.criticalNodes.length ?? 0;
  }

  get placementRecommendations(): SupplyPlacementRecommendation[] {
    return this.supplyAnalysis?.placementRecommendations ?? [];
  }

  get emergencyRoutes(): EmergencySupplyRoute[] {
    return this.supplyAnalysis?.emergencyRoutes ?? [];
  }

  get consumptionRates(): SupplyConsumptionRate[] {
    return this.supplyAnalysis?.consumptionRates ?? [];
  }

  get estimatedDurationHours(): number {
    return this.supplyAnalysis?.estimatedDurationHours ?? 8;
  }

  get hasData(): boolean {
    return this.totalSupplyNodes > 0;
  }

  get allClear(): boolean {
    return this.hasData && this.deficitCount === 0 && this.criticalCount === 0;
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

  getLevelLabel(level: string): string {
    return (SUPPLY_ADEQUACY_MAP as any)[level]?.label || level;
  }

  getSupplyNodeName(nodeId: string): string {
    return this.nodeNames[nodeId] || nodeId;
  }

  getNodeName(nodeId: string): string {
    return this.nodeNames[nodeId] || nodeId;
  }

  getRiskLabel(risk: string): string {
    const riskMap: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '极高'
    };
    return riskMap[risk] || risk;
  }

  getSupplyItemTooltip(item: any): string {
    return `${this.getSupplyLabel(item.type)}: ${item.available.toFixed(1)} / ${item.required.toFixed(1)} (${(item.adequacy * 100).toFixed(0)}%)`;
  }

  onNodeClick(nodeId: string): void {
    this.nodeClick.emit(nodeId);
  }

  onRouteClick(route: EmergencySupplyRoute): void {
    this.routeClick.emit(route);
  }

  onAddSupply(rec: SupplyPlacementRecommendation): void {
    this.addSupplyPoint.emit(rec);
  }

  onRateChange(type: SupplyType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (isNaN(value) || value < 0) return;

    const rates = [...this.consumptionRates];
    const rateIndex = rates.findIndex(r => r.type === type);
    if (rateIndex >= 0) {
      rates[rateIndex] = { ...rates[rateIndex], perPersonPerHour: value };
      this.consumptionRatesChange.emit(rates);
    }
  }

  onDurationChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value >= 1) {
      this.durationChange.emit(value);
    }
  }

  onResetRates(): void {
    this.consumptionRatesChange.emit(JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES)));
  }
}
