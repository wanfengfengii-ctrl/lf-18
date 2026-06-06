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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';
import {
  CommAnalysis,
  CommDevice,
  CommDeviceType,
  NodeCommCoverage,
  SegmentSignalInfo,
  RelayPlacementRecommendation as CommRelayRecommendation,
  DistressReachableInfo,
  COMM_DEVICE_TYPE_MAP,
  SIGNAL_QUALITY_MAP,
  COMM_COVERAGE_LEVEL_MAP,
  SignalQuality,
  CommCoverageLevel
} from '../../models/cave-graph.model';

@Component({
  selector: 'app-comm-panel',
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
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule
  ],
  template: `
    <mat-card class="comm-panel">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>settings_ethernet</mat-icon>
          通信与定位
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">设备总数</span>
            <span class="stat-value">{{ totalDevices }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">在线设备</span>
            <span class="stat-value online">{{ onlineCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">盲区节点</span>
            <span class="stat-value blind">{{ blindSpotCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均电量</span>
            <span class="stat-value battery">{{ avgBattery.toFixed(0) }}%</span>
          </div>
        </div>

        <div class="device-type-stats">
          <div class="device-type-item" *ngFor="let type of deviceTypes">
            <mat-icon [style.color]="type.color">{{ type.icon }}</mat-icon>
            <span class="device-type-name">{{ type.label }}</span>
            <span class="device-type-count">{{ getDeviceCount(type.key) }}</span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="add-device-section">
          <h4 class="section-title">
            <mat-icon>add_circle</mat-icon>
            部署新设备
          </h4>
          <div class="add-device-form">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>设备类型</mat-label>
              <mat-select [(ngModel)]="newDeviceType">
                <mat-option *ngFor="let type of deviceTypes" [value]="type.key">
                  <mat-icon>{{ type.icon }}</mat-icon>
                  {{ type.label }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill" class="full-width">
              <mat-label>部署节点</mat-label>
              <mat-select [(ngModel)]="newDeviceNodeId">
                <mat-option *ngFor="let node of deployableNodes" [value]="node.id">
                  {{ node.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="primary" 
                    (click)="onAddDevice()"
                    [disabled]="!canAddDevice">
              <mat-icon>add</mat-icon>
              部署设备
            </button>
          </div>
        </div>

        <mat-divider></mat-divider>

        <mat-accordion class="comm-accordion">
          <mat-expansion-panel expanded="true">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>devices</mat-icon>
                设备列表
              </mat-panel-title>
              <mat-panel-description>
                {{ devices.length }} 台设备
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let device of devices" 
                             class="device-item"
                             (click)="onDeviceClick(device)">
                <span matListItemTitle class="device-name">
                  <mat-icon class="device-icon" 
                            [style.color]="getDeviceColor(device.type)">
                    {{ getDeviceIcon(device.type) }}
                  </mat-icon>
                  {{ device.name }}
                  <span class="device-status" [ngClass]="device.isOnline ? 'online' : 'offline'">
                    {{ device.isOnline ? '在线' : '离线' }}
                  </span>
                </span>
                <span matListItemLine class="device-sub">
                  {{ getDeviceTypeLabel(device.type) }} · 
                  部署于: {{ getNodeName(device.nodeId) }}
                </span>
                <span matListItemLine class="device-stats">
                  <span class="battery-info">
                    <mat-icon *ngIf="device.batteryLevel > 50">battery_full</mat-icon>
                    <mat-icon *ngIf="device.batteryLevel <= 50 && device.batteryLevel > 20">battery_6_bar</mat-icon>
                    <mat-icon *ngIf="device.batteryLevel <= 20">battery_alert</mat-icon>
                    {{ device.batteryLevel.toFixed(0) }}%
                  </span>
                  <span class="signal-info">
                    信号: {{ device.signalStrength }}%
                  </span>
                  <span class="radius-info">
                    半径: {{ device.coverageRadius }}m
                  </span>
                </span>
                <div class="device-actions">
                  <button mat-icon-button size="small" 
                          (click)="$event.stopPropagation(); onToggleDevice(device.id)"
                          [title]="device.isOnline ? '关机' : '开机'">
                    <mat-icon>{{ device.isOnline ? 'power_off' : 'power' }}</mat-icon>
                  </button>
                  <button mat-icon-button size="small" 
                          (click)="$event.stopPropagation(); onDeleteDevice(device.id)"
                          title="删除">
                    <mat-icon color="warn">delete</mat-icon>
                  </button>
                </div>
              </mat-list-item>
            </mat-list>
            <div class="empty-hint" *ngIf="devices.length === 0">
              暂无设备数据
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel expanded="true">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="coverage-icon">wifi</mat-icon>
                通信覆盖分析
              </mat-panel-title>
              <mat-panel-description>
                覆盖率: {{ coveragePercent.toFixed(1) }}%
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="coverage-summary">
              <div class="coverage-bar-container">
                <div class="coverage-bar full" [style.width.%]="fullCoveragePercent"></div>
                <div class="coverage-bar partial" [style.width.%]="partialCoveragePercent"></div>
                <div class="coverage-bar weak" [style.width.%]="weakCoveragePercent"></div>
                <div class="coverage-bar none" [style.width.%]="noneCoveragePercent"></div>
              </div>
              <div class="coverage-legend">
                <span class="legend-item"><span class="legend-dot full"></span>完全覆盖 ({{ fullCoverageCount }})</span>
                <span class="legend-item"><span class="legend-dot partial"></span>部分覆盖 ({{ partialCoverageCount }})</span>
                <span class="legend-item"><span class="legend-dot weak"></span>弱覆盖 ({{ weakCoverageCount }})</span>
                <span class="legend-item"><span class="legend-dot none"></span>盲区 ({{ noneCoverageCount }})</span>
              </div>
            </div>
            <mat-list dense>
              <mat-list-item *ngFor="let coverage of nodeCoverages" 
                             class="coverage-item"
                             (click)="onNodeClick(coverage.nodeId)">
                <span matListItemTitle class="coverage-name">
                  {{ coverage.nodeName }}
                  <span class="coverage-badge" 
                        [ngClass]="'level-' + coverage.coverageLevel">
                    {{ getCoverageLabel(coverage.coverageLevel) }}
                  </span>
                </span>
                <span matListItemLine class="coverage-sub">
                  信号强度: {{ coverage.signalStrength.toFixed(1) }}% · 
                  信号质量: {{ getSignalLabel(coverage.signalQuality) }}
                </span>
              </mat-list-item>
            </mat-list>
          </mat-expansion-panel>

          <mat-expansion-panel expanded="true" *ngIf="weakSignalSegments.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="weak-icon">signal_wifi_statusbar_4_bar</mat-icon>
                弱信号路线
              </mat-panel-title>
              <mat-panel-description>
                {{ weakSignalSegments.length }} 条绳段
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let sig of weakSignalList" 
                             class="signal-item">
                <span matListItemTitle class="signal-name">
                  {{ sig.segmentId }}
                </span>
                <span matListItemLine class="signal-sub">
                  平均信号: {{ sig.avgSignalStrength.toFixed(1) }}% · 
                  最低: {{ sig.minSignalStrength.toFixed(1) }}% · 
                  覆盖率: {{ sig.coveragePercent.toFixed(0) }}%
                </span>
              </mat-list-item>
            </mat-list>
          </mat-expansion-panel>

          <mat-expansion-panel expanded="true" *ngIf="relayRecommendations.length > 0">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="recommend-icon">star</mat-icon>
                推荐中继位置
              </mat-panel-title>
              <mat-panel-description>
                {{ relayRecommendations.length }} 个推荐
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let rec of relayRecommendations" 
                             class="recommendation-item"
                             (click)="onNodeClick(rec.nodeId)">
                <span matListItemTitle class="rec-name">
                  <span class="rec-score">{{ rec.score }}分</span>
                  {{ rec.nodeName }}
                </span>
                <span matListItemLine class="rec-reason">{{ rec.reason }}</span>
                <span matListItemLine class="rec-coverage">
                  覆盖增益: {{ rec.estimatedCoverageGain }} 节点 · 
                  改善路线: {{ rec.coveredSegments.length }} 条
                </span>
                <button mat-icon-button size="small" 
                        class="add-relay-btn"
                        (click)="$event.stopPropagation(); onAddRelay(rec)"
                        title="快速部署中继">
                  <mat-icon>add_location</mat-icon>
                </button>
              </mat-list-item>
            </mat-list>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="distress-icon">emergency</mat-icon>
                紧急求救可达性
              </mat-panel-title>
              <mat-panel-description>
                {{ reachableCount }} / {{ totalReachableCheck }} 可达
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-list dense>
              <mat-list-item *ngFor="let reach of distressReachability" 
                             class="reach-item"
                             [ngClass]="{ 'unreachable': !reach.isReachable }"
                             (click)="onDistressRouteClick(reach)">
                <span matListItemTitle class="reach-name">
                  {{ reach.nodeName }}
                  <span class="reach-badge" [ngClass]="reach.isReachable ? 'reachable' : 'unreachable'">
                    {{ reach.isReachable ? '可达' : '不可达' }}
                  </span>
                </span>
                <span matListItemLine class="reach-sub" *ngIf="reach.isReachable">
                  最近求救点: {{ reach.nearestDistressName }} · 
                  距离: {{ reach.distanceToDistress.toFixed(1) }}m · 
                  信号: {{ getSignalLabel(reach.signalQuality) }}
                </span>
                <span matListItemLine class="reach-sub" *ngIf="!reach.isReachable">
                  无可用求救点
                </span>
              </mat-list-item>
            </mat-list>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="positioning-icon">gps_fixed</mat-icon>
                定位连续性
              </mat-panel-title>
              <mat-panel-description>
                平均: {{ avgPositioningContinuity.toFixed(1) }}%
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="positioning-summary">
              <p>定位信标数量: {{ beaconCount }}</p>
              <p>平均定位连续性: {{ avgPositioningContinuity.toFixed(1) }}%</p>
              <p class="positioning-hint">
                定位连续性表示撤离路线上定位信号的连续程度，
                低于80%可能导致定位丢失。
              </p>
            </div>
          </mat-expansion-panel>
        </mat-accordion>

        <div class="all-clear" *ngIf="allClear">
          <mat-icon class="check-icon">check_circle</mat-icon>
          <p>通信覆盖良好</p>
        </div>

        <div class="empty-state" *ngIf="!hasDevices">
          <mat-icon class="empty-icon">settings_ethernet</mat-icon>
          <p>暂无通信设备</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .comm-panel {
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
    .stat-value.online {
      color: #4caf50;
    }
    .stat-value.blind {
      color: #f44336;
    }
    .stat-value.battery {
      color: #9c27b0;
    }
    .device-type-stats {
      display: flex;
      justify-content: space-around;
      padding: 12px 0;
    }
    .device-type-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .device-type-name {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .device-type-count {
      font-size: 16px;
      font-weight: 600;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      margin: 12px 0 8px 0;
      color: #333;
    }
    .add-device-section {
      margin: 12px 0;
    }
    .add-device-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .full-width {
      width: 100%;
    }
    .comm-accordion {
      margin: 8px 0;
    }
    .device-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: pointer;
      position: relative;
    }
    .device-item:hover {
      background: rgba(33, 150, 243, 0.05);
    }
    .device-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .device-icon {
      font-size: 20px;
    }
    .device-status {
      margin-left: auto;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .device-status.online {
      background: #4caf50;
      color: white;
    }
    .device-status.offline {
      background: #9e9e9e;
      color: white;
    }
    .device-sub {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .device-stats {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
      margin-top: 4px;
    }
    .battery-info, .signal-info, .radius-info {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .battery-info mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .device-actions {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      gap: 4px;
    }
    .coverage-icon {
      color: #2196f3;
    }
    .coverage-summary {
      margin-bottom: 12px;
    }
    .coverage-bar-container {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .coverage-bar {
      height: 100%;
      transition: width 0.3s;
    }
    .coverage-bar.full { background: #4caf50; }
    .coverage-bar.partial { background: #ffeb3b; }
    .coverage-bar.weak { background: #ff9800; }
    .coverage-bar.none { background: #f44336; }
    .coverage-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 11px;
      color: #666;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .legend-dot.full { background: #4caf50; }
    .legend-dot.partial { background: #ffeb3b; }
    .legend-dot.weak { background: #ff9800; }
    .legend-dot.none { background: #f44336; }
    .coverage-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: pointer;
    }
    .coverage-item:hover {
      background: rgba(33, 150, 243, 0.05);
    }
    .coverage-name {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
    }
    .coverage-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    .level-full { background: #4caf50; }
    .level-partial { background: #ffeb3b; color: #333; }
    .level-weak { background: #ff9800; }
    .level-none { background: #f44336; }
    .coverage-sub {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .weak-icon {
      color: #ff9800;
    }
    .signal-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .signal-name {
      font-weight: 500;
    }
    .signal-sub {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
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
    .add-relay-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
    }
    .distress-icon {
      color: #f44336;
    }
    .reach-item {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      cursor: pointer;
    }
    .reach-item:hover {
      background: rgba(244, 67, 54, 0.05);
    }
    .reach-item.unreachable {
      opacity: 0.7;
    }
    .reach-name {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
    }
    .reach-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    .reach-badge.reachable { background: #4caf50; }
    .reach-badge.unreachable { background: #f44336; }
    .reach-sub {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    .positioning-icon {
      color: #9c27b0;
    }
    .positioning-summary {
      padding: 8px 0;
      font-size: 13px;
    }
    .positioning-summary p {
      margin: 4px 0;
    }
    .positioning-hint {
      color: #666;
      font-size: 12px;
      font-style: italic;
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
export class CommPanelComponent {
  @Input() commAnalysis: CommAnalysis | null = null;
  @Input() nodeNames: Record<string, string> = {};
  @Input() devices: CommDevice[] = [];
  @Input() deployableNodes: { id: string; name: string }[] = [];

  @Output() deviceClick = new EventEmitter<CommDevice>();
  @Output() nodeClick = new EventEmitter<string>();
  @Output() addDevice = new EventEmitter<{ type: CommDeviceType; nodeId: string }>();
  @Output() toggleDevice = new EventEmitter<string>();
  @Output() deleteDevice = new EventEmitter<string>();
  @Output() addRelayRecommendation = new EventEmitter<CommRelayRecommendation>();
  @Output() distressRouteClick = new EventEmitter<DistressReachableInfo>();

  newDeviceType: CommDeviceType = 'relay';
  newDeviceNodeId: string = '';

  readonly deviceTypes = [
    { key: 'relay' as CommDeviceType, ...COMM_DEVICE_TYPE_MAP.relay },
    { key: 'beacon' as CommDeviceType, ...COMM_DEVICE_TYPE_MAP.beacon },
    { key: 'distress' as CommDeviceType, ...COMM_DEVICE_TYPE_MAP.distress }
  ];

  get totalDevices(): number {
    return this.commAnalysis?.totalDevices ?? 0;
  }

  get onlineCount(): number {
    return this.commAnalysis?.onlineCount ?? 0;
  }

  get blindSpotCount(): number {
    return this.commAnalysis?.blindSpotNodes.length ?? 0;
  }

  get avgBattery(): number {
    return this.commAnalysis?.avgBatteryLevel ?? 0;
  }

  get nodeCoverages(): NodeCommCoverage[] {
    return this.commAnalysis?.nodeCoverages ?? [];
  }

  get weakSignalList(): SegmentSignalInfo[] {
    return this.commAnalysis?.segmentSignals.filter(s => s.isWeakSignal || s.isBlindSpot) ?? [];
  }

  get weakSignalSegments(): string[] {
    return this.commAnalysis?.weakSignalSegments ?? [];
  }

  get relayRecommendations(): CommRelayRecommendation[] {
    return this.commAnalysis?.relayRecommendations ?? [];
  }

  get distressReachability(): DistressReachableInfo[] {
    return this.commAnalysis?.distressReachability ?? [];
  }

  get unreachableCount(): number {
    return this.commAnalysis?.unreachableDistressNodes.length ?? 0;
  }

  get reachableCount(): number {
    return this.totalReachableCheck - this.unreachableCount;
  }

  get totalReachableCheck(): number {
    return this.commAnalysis?.distressReachability.length ?? 0;
  }

  get avgPositioningContinuity(): number {
    return this.commAnalysis?.avgPositioningContinuity ?? 0;
  }

  get beaconCount(): number {
    return this.commAnalysis?.beaconCount ?? 0;
  }

  get fullCoverageCount(): number {
    return this.commAnalysis?.fullCoverageNodes.length ?? 0;
  }

  get partialCoverageCount(): number {
    return this.nodeCoverages.filter(c => c.coverageLevel === 'partial').length;
  }

  get weakCoverageCount(): number {
    return this.nodeCoverages.filter(c => c.coverageLevel === 'weak').length;
  }

  get noneCoverageCount(): number {
    return this.commAnalysis?.blindSpotNodes.length ?? 0;
  }

  get totalCoverageNodes(): number {
    return this.nodeCoverages.length;
  }

  get fullCoveragePercent(): number {
    return this.totalCoverageNodes > 0 ? (this.fullCoverageCount / this.totalCoverageNodes) * 100 : 0;
  }

  get partialCoveragePercent(): number {
    return this.totalCoverageNodes > 0 ? (this.partialCoverageCount / this.totalCoverageNodes) * 100 : 0;
  }

  get weakCoveragePercent(): number {
    return this.totalCoverageNodes > 0 ? (this.weakCoverageCount / this.totalCoverageNodes) * 100 : 0;
  }

  get noneCoveragePercent(): number {
    return this.totalCoverageNodes > 0 ? (this.noneCoverageCount / this.totalCoverageNodes) * 100 : 0;
  }

  get coveragePercent(): number {
    return this.fullCoveragePercent + this.partialCoveragePercent;
  }

  get hasDevices(): boolean {
    return this.totalDevices > 0;
  }

  get allClear(): boolean {
    return this.hasDevices && this.blindSpotCount === 0 && this.unreachableCount === 0;
  }

  get canAddDevice(): boolean {
    return this.newDeviceType && this.newDeviceNodeId !== '';
  }

  getDeviceCount(type: CommDeviceType): number {
    return this.devices.filter(d => d.type === type).length;
  }

  getDeviceColor(type: CommDeviceType): string {
    return COMM_DEVICE_TYPE_MAP[type]?.color || '#999';
  }

  getDeviceIcon(type: CommDeviceType): string {
    return COMM_DEVICE_TYPE_MAP[type]?.icon || 'device_unknown';
  }

  getDeviceTypeLabel(type: CommDeviceType): string {
    return COMM_DEVICE_TYPE_MAP[type]?.label || type;
  }

  getSignalLabel(quality: SignalQuality): string {
    return SIGNAL_QUALITY_MAP[quality]?.label || quality;
  }

  getCoverageLabel(level: CommCoverageLevel): string {
    return COMM_COVERAGE_LEVEL_MAP[level]?.label || level;
  }

  getNodeName(nodeId: string): string {
    return this.nodeNames[nodeId] || nodeId;
  }

  onDeviceClick(device: CommDevice): void {
    this.deviceClick.emit(device);
  }

  onNodeClick(nodeId: string): void {
    this.nodeClick.emit(nodeId);
  }

  onAddDevice(): void {
    if (this.canAddDevice) {
      this.addDevice.emit({ type: this.newDeviceType, nodeId: this.newDeviceNodeId });
      this.newDeviceNodeId = '';
    }
  }

  onToggleDevice(deviceId: string): void {
    this.toggleDevice.emit(deviceId);
  }

  onDeleteDevice(deviceId: string): void {
    if (confirm('确定要删除此设备吗？')) {
      this.deleteDevice.emit(deviceId);
    }
  }

  onAddRelay(rec: CommRelayRecommendation): void {
    this.addRelayRecommendation.emit(rec);
  }

  onDistressRouteClick(reach: DistressReachableInfo): void {
    if (reach.isReachable) {
      this.distressRouteClick.emit(reach);
    }
  }
}
