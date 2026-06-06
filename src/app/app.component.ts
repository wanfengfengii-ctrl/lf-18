import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';

import { NotificationService } from './core/notification.service';
import { GraphStateService } from './core/state/graph-state.service';
import { PathAnalysisService } from './modules/path-analysis/path-analysis.service';
import { GraphAnalysisService } from './modules/path-analysis/graph-analysis.service';
import { SupplyService } from './modules/supply/supply.service';
import { CommService } from './modules/comm/comm.service';
import { SimulationService } from './modules/simulation/simulation.service';
import { VersionService } from './modules/version/version.service';
import { GraphEditorService } from './modules/graph-editor/graph-editor.service';

import {
  CaveNode,
  RopeSegment,
  GraphAnalysis,
  PathResult,
  NODE_TYPE_MAP,
  SUPPLY_TYPE_MAP,
  TeamConfig,
  RouteVersion,
  RouteComparison,
  SimulationResult,
  GraphHighlight,
  SupplyAnalysis,
  SupplyItem,
  SupplyPlacementRecommendation,
  EmergencySupplyRoute,
  SupplyConsumptionRate,
  CommDevice,
  CommAnalysis,
  CommDeviceType
} from './shared/models';

import { CytoscapeGraphComponent } from './components/cytoscape-graph/cytoscape-graph.component';
import { NodeEditorComponent } from './components/node-editor/node-editor.component';
import { SegmentEditorComponent } from './components/segment-editor/segment-editor.component';
import { StatsPanelComponent } from './components/stats-panel/stats-panel.component';
import { PathAnalysisComponent } from './components/path-analysis/path-analysis.component';
import { TeamConfigComponent } from './components/team-config/team-config.component';
import { SimulationPanelComponent } from './components/simulation-panel/simulation-panel.component';
import { RouteVersionPanelComponent } from './components/route-version-panel/route-version-panel.component';
import { OverloadConfirmDialogComponent } from './components/overload-confirm-dialog/overload-confirm-dialog.component';
import { SupplyPanelComponent } from './components/supply-panel/supply-panel.component';
import { SupplyEditorComponent } from './components/supply-editor/supply-editor.component';
import { CommPanelComponent } from './components/comm-panel/comm-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatTabsModule,
    MatDialogModule,
    MatDividerModule,
    CytoscapeGraphComponent,
    NodeEditorComponent,
    SegmentEditorComponent,
    StatsPanelComponent,
    PathAnalysisComponent,
    TeamConfigComponent,
    SimulationPanelComponent,
    RouteVersionPanelComponent,
    SupplyPanelComponent,
    SupplyEditorComponent,
    CommPanelComponent
  ],
  template: `
    <div class="app-container">
      <mat-toolbar color="primary" class="app-toolbar">
        <mat-icon>terrain</mat-icon>
        <span class="app-title">洞穴探测绳路规划系统</span>
        <span class="spacer"></span>
        <button mat-icon-button (click)="onAddNode()" title="添加节点">
          <mat-icon>add_circle</mat-icon>
        </button>
        <button mat-icon-button (click)="onAddSegment()" title="添加绳段">
          <mat-icon>timeline</mat-icon>
        </button>
        <button mat-icon-button (click)="onLoadSample()" title="加载示例">
          <mat-icon>folder_open</mat-icon>
        </button>
        <button mat-icon-button (click)="onClearAll()" title="清空所有" color="warn">
          <mat-icon>delete_sweep</mat-icon>
        </button>
        <button mat-icon-button (click)="onToggleSimulation()"
                [color]="isSimulationMode ? 'warn' : ''"
                [title]="isSimulationMode ? '退出演练模式' : '进入演练模式'">
          <mat-icon>{{ isSimulationMode ? 'science' : 'play_arrow' }}</mat-icon>
        </button>
        <button mat-icon-button (click)="onFit()" title="适应视图">
          <mat-icon>zoom_out_map</mat-icon>
        </button>
      </mat-toolbar>

      <div class="main-content">
        <div class="graph-container">
          <app-cytoscape-graph
            [nodes]="nodes"
            [segments]="segments"
            [selectedNodeId]="selectedNodeId"
            [selectedSegmentId]="selectedSegmentId"
            [disconnectedNodes]="disconnectedNodes"
            [overloadAnchors]="overloadAnchors"
            [highlights]="highlights"
            [highlightPath]="highlightPathNodes"
            [highlightPathSegments]="highlightPathSegments"
            [blockedNodes]="blockedNodes"
            [blockedSegments]="blockedSegments"
            [simulatedRemovedNodes]="simulatedRemovedNodes"
            [simulatedRemovedSegments]="simulatedRemovedSegments"
            [isSimulationMode]="isSimulationMode"
            (nodeClick)="onNodeClick($event)"
            (nodeDblClick)="onNodeDblClick($event)"
            (segmentClick)="onSegmentClick($event)"
            (segmentDblClick)="onSegmentDblClick($event)"
            (nodeDragEnd)="onNodeDragEnd($event)"
            (canvasClick)="onCanvasClick()"
          ></app-cytoscape-graph>

          <div class="legend">
            <div class="legend-title">图例</div>
            <div class="legend-items">
              <div class="legend-item" *ngFor="let type of legendItems">
                <span class="legend-shape" [style.backgroundColor]="type.color" [style.borderRadius]="type.shape === 'round' ? '50%' : '4px'"></span>
                <span class="legend-label">{{ type.label }}</span>
              </div>
            </div>
            <div class="legend-divider"></div>
            <div class="legend-items">
              <div class="legend-item">
                <span class="legend-shape key-anchor"></span>
                <span class="legend-label">关键锚点</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape bottleneck"></span>
                <span class="legend-label">瓶颈路线</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape safe-route"></span>
                <span class="legend-label">安全路线</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape supply-point"></span>
                <span class="legend-label">补给站</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape supply-deficit"></span>
                <span class="legend-label">物资不足</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape emergency-route"></span>
                <span class="legend-label">应急路线</span>
              </div>
            </div>
            <div class="legend-divider"></div>
            <div class="legend-items">
              <div class="legend-item">
                <span class="legend-shape comm-relay"></span>
                <span class="legend-label">中继台</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape comm-beacon"></span>
                <span class="legend-label">定位信标</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape comm-distress"></span>
                <span class="legend-label">求救点</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape comm-blind-spot"></span>
                <span class="legend-label">通信盲区</span>
              </div>
              <div class="legend-item">
                <span class="legend-shape weak-signal"></span>
                <span class="legend-label">弱信号路线</span>
              </div>
            </div>
          </div>

          <div class="simulation-banner" *ngIf="isSimulationMode">
            <mat-icon>science</mat-icon>
            <span>演练模式 - 已移除 {{ simulatedRemovedNodes.length }} 个节点, {{ simulatedRemovedSegments.length }} 个绳段</span>
            <button mat-button color="warn" (click)="onExitSimulation()">退出</button>
          </div>
        </div>

        <mat-sidenav-container class="side-panel">
          <mat-sidenav mode="side" opened="true" position="end" class="sidenav">
            <mat-tab-group>
              <mat-tab label="编辑">
                <div class="tab-content">
                  <div *ngIf="selectedNode">
                    <app-node-editor
                      [node]="selectedNode"
                      [existingIds]="existingNodeIds"
                      (save)="onSaveNode($event)"
                      (delete)="onDeleteNode($event)"
                      (cancel)="onCancelEdit()"
                    ></app-node-editor>
                  </div>
                  <div *ngIf="selectedSegment">
                    <app-segment-editor
                      [segment]="selectedSegment"
                      [nodes]="nodes"
                      (save)="onSaveSegment($event)"
                      (delete)="onDeleteSegment($event)"
                      (cancel)="onCancelEdit()"
                    ></app-segment-editor>
                  </div>
                  <div *ngIf="!selectedNode && !selectedSegment && showNodeForm">
                    <app-node-editor
                      [node]="null"
                      [existingIds]="existingNodeIds"
                      [defaultPosition]="clickPosition"
                      (save)="onSaveNode($event)"
                      (cancel)="onCancelEdit()"
                    ></app-node-editor>
                  </div>
                  <div *ngIf="!selectedNode && !selectedSegment && showSegmentForm">
                    <app-segment-editor
                      [segment]="null"
                      [nodes]="nodes"
                      (save)="onSaveSegment($event)"
                      (cancel)="onCancelEdit()"
                    ></app-segment-editor>
                  </div>
                  <div *ngIf="!selectedNode && !selectedSegment && !showNodeForm && !showSegmentForm" class="empty-edit">
                    <mat-icon>edit_note</mat-icon>
                    <p>点击节点或绳段进行编辑</p>
                    <p>或使用工具栏添加新元素</p>
                  </div>
                </div>
              </mat-tab>
              <mat-tab label="分析">
                <div class="tab-content">
                  <app-stats-panel
                    [analysis]="analysis"
                    [nodeNames]="nodeNames"
                    [segments]="segments"
                    (nodeClick)="onNodeClick($event)"
                  ></app-stats-panel>
                  <app-path-analysis
                    [nodeOptions]="nodeOptions"
                    [paths]="selectedPaths"
                    [nodeNames]="nodeNames"
                    [selectedNode]="selectedNodeId"
                    (nodeSelect)="onPathNodeSelect($event)"
                    (pathHighlight)="onPathHighlight($event)"
                  ></app-path-analysis>
                </div>
              </mat-tab>
              <mat-tab label="队伍">
                <div class="tab-content">
                  <app-team-config
                    [config]="teamConfig"
                    (configChange)="onTeamConfigChange($event)"
                  ></app-team-config>
                </div>
              </mat-tab>
              <mat-tab label="物资">
                <div class="tab-content">
                  <app-supply-panel
                    [supplyAnalysis]="supplyAnalysis"
                    [nodeNames]="nodeNames"
                    (nodeClick)="onSupplyNodeClick($event)"
                    (routeClick)="onEmergencyRouteClick($event)"
                    (addSupplyPoint)="onAddSupplyPoint($event)"
                    (consumptionRatesChange)="onConsumptionRatesChange($event)"
                    (durationChange)="onDurationChange($event)"
                  ></app-supply-panel>
                  <div *ngIf="selectedSupplyNode" class="supply-editor-section">
                    <mat-divider></mat-divider>
                    <app-supply-editor
                      [supplies]="selectedSupplyNodeSupplies"
                      [nodeName]="selectedSupplyNode.name"
                      [nodeId]="selectedSupplyNode.id"
                      (save)="onSupplySave($event)"
                    ></app-supply-editor>
                  </div>
                </div>
              </mat-tab>
              <mat-tab label="通信">
                <div class="tab-content">
                  <app-comm-panel
                    [commAnalysis]="commAnalysis"
                    [nodeNames]="nodeNames"
                    [devices]="commDevices"
                    [deployableNodes]="deployableNodes"
                    (deviceClick)="onCommDeviceClick($event)"
                    (nodeClick)="onCommNodeClick($event)"
                    (addDevice)="onAddCommDevice($event)"
                    (toggleDevice)="onToggleCommDevice($event)"
                    (deleteDevice)="onDeleteCommDevice($event)"
                    (addRelayRecommendation)="onAddCommRelayRecommendation($event)"
                    (distressRouteClick)="onCommDistressRouteClick($event)"
                  ></app-comm-panel>
                </div>
              </mat-tab>
              <mat-tab label="演练">
                <div class="tab-content">
                  <app-simulation-panel
                    [nodes]="nodes"
                    [segments]="segments"
                    [isSimulationMode]="isSimulationMode"
                    [simulationResult]="simulationResult"
                    [removedNodes]="simulatedRemovedNodes"
                    [removedSegments]="simulatedRemovedSegments"
                    (toggleMode)="onToggleSimulation()"
                    (nodeToggle)="onSimNodeToggle($event)"
                    (segmentToggle)="onSimSegmentToggle($event)"
                    (runSimulation)="onRunSimulation()"
                  ></app-simulation-panel>
                </div>
              </mat-tab>
              <mat-tab label="版本">
                <div class="tab-content">
                  <app-route-version-panel
                    [versions]="routeVersions"
                    [comparison]="routeComparison"
                    (saveVersion)="onSaveVersion($event)"
                    (loadVersion)="onLoadVersion($event)"
                    (deleteVersion)="onDeleteVersion($event)"
                    (compareVersions)="onCompareVersions($event)"
                  ></app-route-version-panel>
                </div>
              </mat-tab>
            </mat-tab-group>
          </mat-sidenav>
        </mat-sidenav-container>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .app-toolbar {
      z-index: 2;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .app-title {
      margin-left: 8px;
      font-size: 18px;
    }
    .spacer {
      flex: 1;
    }
    .main-content {
      flex: 1;
      display: flex;
      position: relative;
      overflow: hidden;
    }
    .graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .legend {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(255, 255, 255, 0.95);
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10;
    }
    .legend-title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 8px;
      color: #333;
    }
    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #555;
    }
    .legend-shape {
      width: 14px;
      height: 14px;
      display: inline-block;
      border-radius: 4px;
    }
    .legend-shape.key-anchor {
      background: #9c27b0;
      border-radius: 50%;
    }
    .legend-shape.bottleneck {
      background: #ff9800;
      border-radius: 2px;
    }
    .legend-shape.safe-route {
      background: #00e676;
      border-radius: 2px;
    }
    .legend-shape.supply-point {
      background: #00bcd4;
      clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
      border-radius: 0;
    }
    .legend-shape.supply-deficit {
      background: transparent;
      border: 2px dashed #ff9800;
      border-radius: 50%;
    }
    .legend-shape.emergency-route {
      background: transparent;
      border: 2px dashed #ffeb3b;
      width: 20px;
      height: 0;
      margin-top: 8px;
      border-radius: 0;
    }
    .legend-shape.comm-relay {
      background: #fff;
      border: 3px double #2196F3;
      border-radius: 50%;
    }
    .legend-shape.comm-beacon {
      background: #fff;
      border: 3px solid #9C27B0;
      border-radius: 50%;
    }
    .legend-shape.comm-distress {
      background: #fff;
      border: 3px double #F44336;
      border-radius: 50%;
    }
    .legend-shape.comm-blind-spot {
      background: #ffebee;
      border: 2px dashed #f44336;
      border-radius: 50%;
    }
    .legend-shape.weak-signal {
      background: transparent;
      border: 2px dashed #ff9800;
      width: 20px;
      height: 0;
      margin-top: 8px;
      border-radius: 0;
    }
    .legend-divider {
      height: 1px;
      background: rgba(0,0,0,0.1);
      margin: 8px 0;
    }
    .simulation-banner {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #f44336;
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(244, 67, 54, 0.4);
    }
    .simulation-banner button {
      color: white;
      margin-left: 8px;
    }
    .side-panel {
      width: 380px;
      min-width: 380px;
    }
    .sidenav {
      width: 380px;
    }
    .tab-content {
      height: calc(100vh - 140px);
      overflow-y: auto;
    }
    .empty-edit {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: #999;
    }
    .empty-edit mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }
    .empty-edit p {
      margin: 4px 0;
      font-size: 13px;
    }
    .supply-editor-section {
      margin-top: 12px;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild(CytoscapeGraphComponent) graphComponent!: CytoscapeGraphComponent;

  nodes: CaveNode[] = [];
  segments: RopeSegment[] = [];

  selectedNodeId: string | null = null;
  selectedSegmentId: string | null = null;

  showNodeForm = false;
  showSegmentForm = false;
  clickPosition = { x: 300, y: 300 };

  analysis: GraphAnalysis | null = null;
  selectedPaths: PathResult[] = [];
  disconnectedNodes: string[] = [];
  overloadAnchors: string[] = [];
  highlights: GraphHighlight | null = null;

  teamConfig: TeamConfig = { members: [], passingOrder: [], safetyFactor: 1.5 };

  routeVersions: RouteVersion[] = [];
  routeComparison: RouteComparison | null = null;

  isSimulationMode = false;
  simulatedRemovedNodes: string[] = [];
  simulatedRemovedSegments: string[] = [];
  simulationResult: SimulationResult | null = null;

  highlightPathNodes: string[] = [];
  highlightPathSegments: string[] = [];

  supplyAnalysis: SupplyAnalysis | null = null;
  selectedSupplyNodeId: string | null = null;
  emergencyRouteNodes: string[] = [];
  emergencyRouteSegments: string[] = [];

  commDevices: CommDevice[] = [];
  commAnalysis: CommAnalysis | null = null;

  private subscriptions = new Subscription();

  get selectedSupplyNode(): CaveNode | null {
    if (!this.selectedSupplyNodeId) return null;
    return this.nodes.find(n => n.id === this.selectedSupplyNodeId) || null;
  }

  get selectedSupplyNodeSupplies(): SupplyItem[] {
    return this.selectedSupplyNode?.supplies || [];
  }

  readonly legendItems = [
    { label: '入口', color: NODE_TYPE_MAP.entrance.color, shape: 'square' },
    { label: '平台', color: NODE_TYPE_MAP.platform.color, shape: 'square' },
    { label: '竖井', color: NODE_TYPE_MAP.shaft.color, shape: 'round' },
    { label: '锚点', color: NODE_TYPE_MAP.anchor.color, shape: 'round' },
    { label: '危险区域', color: NODE_TYPE_MAP.danger.color, shape: 'round' },
    { label: '补给站', color: NODE_TYPE_MAP.supply.color, shape: 'hexagon' }
  ];

  constructor(
    private graphState: GraphStateService,
    private pathAnalysis: PathAnalysisService,
    private graphAnalysisService: GraphAnalysisService,
    private supplyService: SupplyService,
    private commService: CommService,
    private simulationService: SimulationService,
    private versionService: VersionService,
    private graphEditor: GraphEditorService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.graphState.getNodes().subscribe(nodes => {
        this.nodes = nodes;
      })
    );

    this.subscriptions.add(
      this.graphState.getSegments().subscribe(segments => {
        this.segments = segments;
      })
    );

    this.subscriptions.add(
      this.graphAnalysisService.getAnalysis().subscribe(analysis => {
        this.analysis = analysis;
        this.disconnectedNodes = analysis.disconnectedNodes;
        this.overloadAnchors = analysis.overloadedAnchors.map(a => a.nodeId);
        this.highlights = analysis.highlights || null;
        this.supplyAnalysis = analysis.supplyAnalysis || null;
        this.commAnalysis = analysis.commAnalysis || null;
      })
    );

    this.subscriptions.add(
      this.commService.getCommDevices().subscribe(devices => {
        this.commDevices = devices;
      })
    );

    this.subscriptions.add(
      this.graphEditor.getTeamConfig().subscribe(config => {
        this.teamConfig = config;
        this.pathAnalysis.setTeamConfig(config);
      })
    );

    this.subscriptions.add(
      this.versionService.getRouteVersions().subscribe(versions => {
        this.routeVersions = versions;
      })
    );

    this.subscriptions.add(
      this.simulationService.getSimulationMode().subscribe(mode => {
        this.isSimulationMode = mode;
        this.pathAnalysis.setSimulationMode(mode);
      })
    );

    this.subscriptions.add(
      this.simulationService.getSimulatedRemovedNodes().subscribe(nodes => {
        this.simulatedRemovedNodes = nodes;
        this.pathAnalysis.setSimulatedRemovedNodes(nodes);
      })
    );

    this.subscriptions.add(
      this.simulationService.getSimulatedRemovedSegments().subscribe(segments => {
        this.simulatedRemovedSegments = segments;
        this.pathAnalysis.setSimulatedRemovedSegments(segments);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get blockedNodes(): string[] {
    return this.nodes.filter(n => n.isBlocked).map(n => n.id);
  }

  get blockedSegments(): string[] {
    return this.segments.filter(s => s.isBlocked).map(s => s.id);
  }

  get selectedNode(): CaveNode | null {
    if (!this.selectedNodeId) return null;
    return this.nodes.find(n => n.id === this.selectedNodeId) || null;
  }

  get selectedSegment(): RopeSegment | null {
    if (!this.selectedSegmentId) return null;
    return this.segments.find(s => s.id === this.selectedSegmentId) || null;
  }

  get existingNodeIds(): string[] {
    return this.nodes.map(n => n.id);
  }

  get nodeNames(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const node of this.nodes) {
      result[node.id] = node.name;
    }
    return result;
  }

  get deployableNodes(): { id: string; name: string }[] {
    return this.nodes.filter(n => !n.isBlocked).map(n => ({ id: n.id, name: n.name }));
  }

  get nodeOptions(): { id: string; name: string }[] {
    return this.nodes.map(n => ({ id: n.id, name: n.name }));
  }

  onNodeClick(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.selectedSegmentId = null;
    this.showNodeForm = false;
    this.showSegmentForm = false;
    this.selectedPaths = this.pathAnalysis.findPathsToEntrance(nodeId);
    this.highlightPathNodes = [];
    this.highlightPathSegments = [];
  }

  onNodeDblClick(nodeId: string): void {
    this.onNodeClick(nodeId);
  }

  onSegmentClick(segmentId: string): void {
    this.selectedSegmentId = segmentId;
    this.selectedNodeId = null;
    this.showNodeForm = false;
    this.showSegmentForm = false;
  }

  onSegmentDblClick(segmentId: string): void {
    this.onSegmentClick(segmentId);
  }

  onCanvasClick(): void {
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
    this.selectedSupplyNodeId = null;
  }

  onNodeDragEnd(event: { id: string; x: number; y: number }): void {
    this.graphState.updateNode(event.id, { x: event.x, y: event.y });
  }

  onAddNode(): void {
    this.showNodeForm = true;
    this.showSegmentForm = false;
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
    this.clickPosition = {
      x: 200 + Math.random() * 300,
      y: 200 + Math.random() * 300
    };
  }

  onAddSegment(): void {
    if (this.nodes.length < 2) {
      this.notification.warning('至少需要两个节点才能添加绳段');
      return;
    }
    this.showSegmentForm = true;
    this.showNodeForm = false;
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
  }

  onSaveNode(node: CaveNode): void {
    try {
      if (this.selectedNodeId) {
        this.graphState.updateNode(node.id, {
          name: node.name,
          type: node.type,
          description: node.description,
          maxLoad: node.maxLoad,
          isBlocked: node.isBlocked
        });
        this.notification.success('节点已更新');
      } else {
        this.graphState.addNode(node);
        this.selectedNodeId = node.id;
        this.showNodeForm = false;
        this.notification.success('节点已添加');
      }
    } catch (e: any) {
      this.notification.error(e.message || '操作失败');
    }
  }

  onDeleteNode(nodeId: string): void {
    if (confirm('确定要删除此节点吗？相关联的绳段也将被删除。')) {
      this.graphState.deleteNode(nodeId);
      this.selectedNodeId = null;
      if (this.selectedSupplyNodeId === nodeId) {
        this.selectedSupplyNodeId = null;
      }
      this.notification.success('节点已删除');
    }
  }

  onSaveSegment(segment: RopeSegment): void {
    try {
      const overloadCheck = this.pathAnalysis.checkSegmentOverload(
        segment.sourceId,
        segment.targetId,
        segment.maxLoad,
        this.selectedSegmentId || undefined
      );

      if (overloadCheck.overloadedAnchors.length > 0) {
        const dialogRef = this.dialog.open(OverloadConfirmDialogComponent, {
          width: '400px',
          data: {
            overloadedAnchors: overloadCheck.overloadedAnchors,
            segmentName: segment.length + 'm 绳段'
          }
        });

        dialogRef.afterClosed().subscribe(confirmed => {
          if (confirmed) {
            this.doSaveSegment(segment);
          }
        });
      } else {
        this.doSaveSegment(segment);
      }
    } catch (e: any) {
      this.notification.error(e.message || '操作失败');
    }
  }

  private doSaveSegment(segment: RopeSegment): void {
    try {
      if (this.selectedSegmentId) {
        this.graphState.updateSegment(segment.id, {
          sourceId: segment.sourceId,
          targetId: segment.targetId,
          length: segment.length,
          slope: segment.slope,
          maxLoad: segment.maxLoad,
          riskLevel: segment.riskLevel,
          traversalDirection: segment.traversalDirection,
          isBlocked: segment.isBlocked,
          description: segment.description
        });
        this.notification.success('绳段已更新');
      } else {
        const newSeg = this.graphState.addSegment(segment);
        this.selectedSegmentId = newSeg.id;
        this.showSegmentForm = false;
        this.notification.success('绳段已添加');
      }
    } catch (e: any) {
      this.notification.error(e.message || '操作失败');
    }
  }

  onDeleteSegment(segmentId: string): void {
    if (confirm('确定要删除此绳段吗？')) {
      this.graphState.deleteSegment(segmentId);
      this.selectedSegmentId = null;
      this.notification.success('绳段已删除');
    }
  }

  onCancelEdit(): void {
    this.showNodeForm = false;
    this.showSegmentForm = false;
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
  }

  onPathNodeSelect(nodeId: string): void {
    this.selectedPaths = this.pathAnalysis.findPathsToEntrance(nodeId);
    this.selectedNodeId = nodeId;
    this.selectedSegmentId = null;
    this.highlightPathNodes = [];
    this.highlightPathSegments = [];
  }

  onPathHighlight(event: { nodes: string[]; segments: string[] }): void {
    this.highlightPathNodes = event.nodes;
    this.highlightPathSegments = event.segments;
  }

  onTeamConfigChange(config: TeamConfig): void {
    this.graphEditor.setTeamConfig(config);
  }

  onToggleSimulation(): void {
    if (this.isSimulationMode) {
      this.simulationService.exitSimulationMode();
      this.simulationResult = null;
      this.notification.success('已退出演练模式');
    } else {
      this.simulationService.enterSimulationMode();
      this.notification.success('已进入演练模式');
    }
  }

  onExitSimulation(): void {
    this.onToggleSimulation();
  }

  onSimNodeToggle(nodeId: string): void {
    if (this.simulatedRemovedNodes.includes(nodeId)) {
      this.simulationService.simulateRestoreNode(nodeId);
    } else {
      this.simulationService.simulateRemoveNode(nodeId);
    }
  }

  onSimSegmentToggle(segmentId: string): void {
    if (this.simulatedRemovedSegments.includes(segmentId)) {
      this.simulationService.simulateRestoreSegment(segmentId);
    } else {
      this.simulationService.simulateRemoveSegment(segmentId);
    }
  }

  onRunSimulation(): void {
    this.simulationResult = this.simulationService.runSimulation();
    this.notification.success('模拟分析完成');
  }

  onSaveVersion(data: { name: string; description?: string }): void {
    this.versionService.saveRouteVersion(data.name, data.description);
    this.notification.success('版本已保存');
  }

  onLoadVersion(versionId: string): void {
    if (confirm('确定要加载此版本吗？当前未保存的更改将丢失。')) {
      this.versionService.loadRouteVersion(versionId);
      this.notification.success('版本已加载');
    }
  }

  onDeleteVersion(versionId: string): void {
    if (confirm('确定要删除此版本吗？')) {
      this.versionService.deleteRouteVersion(versionId);
      this.routeComparison = null;
      this.notification.success('版本已删除');
    }
  }

  onCompareVersions(data: { versionAId: string; versionBId: string }): void {
    this.routeComparison = this.versionService.compareRouteVersions(
      data.versionAId,
      data.versionBId
    );
  }

  onLoadSample(): void {
    this.graphEditor.loadSampleData();
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
    this.showNodeForm = false;
    this.showSegmentForm = false;
    this.routeComparison = null;
    this.simulationResult = null;
    this.notification.success('示例数据已加载');
    setTimeout(() => {
      if (this.graphComponent) {
        this.graphComponent.fit();
      }
    }, 100);
  }

  onClearAll(): void {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      this.graphEditor.clearAll();
      this.selectedNodeId = null;
      this.selectedSegmentId = null;
      this.selectedSupplyNodeId = null;
      this.selectedPaths = [];
      this.routeComparison = null;
      this.simulationResult = null;
      this.highlightPathNodes = [];
      this.highlightPathSegments = [];
      this.emergencyRouteNodes = [];
      this.emergencyRouteSegments = [];
      this.notification.success('所有数据已清空');
    }
  }

  onFit(): void {
    if (this.graphComponent) {
      this.graphComponent.fit();
    }
  }

  onSupplyNodeClick(nodeId: string): void {
    this.selectedSupplyNodeId = nodeId;
    this.selectedNodeId = nodeId;
    this.selectedSegmentId = null;
  }

  onEmergencyRouteClick(route: EmergencySupplyRoute): void {
    this.emergencyRouteNodes = route.path;
    this.emergencyRouteSegments = route.segments;
    this.notification.info(`应急补给路线: ${this.getNodeName(route.fromNodeId)} → ${this.getNodeName(route.toSupplyNodeId)}`);
  }

  onAddSupplyPoint(rec: SupplyPlacementRecommendation): void {
    const node = this.nodes.find(n => n.id === rec.nodeId);
    if (!node) return;

    if (node.type === 'supply') {
      this.selectedSupplyNodeId = rec.nodeId;
      this.notification.info('该节点已是补给站');
      return;
    }

    if (confirm(`确定要将 ${node.name} 设为补给站吗？`)) {
      const supplies: SupplyItem[] = rec.recommendedSupplies.map(s => {
        const supplyInfo = SUPPLY_TYPE_MAP[s.type];
        return {
          type: s.type,
          quantity: s.quantity,
          unitWeight: supplyInfo.defaultUnitWeight,
          minSafetyStock: supplyInfo.defaultMinStock,
          priority: supplyInfo.defaultPriority
        };
      });

      this.graphState.updateNode(rec.nodeId, {
        type: 'supply',
        supplies
      });
      this.selectedSupplyNodeId = rec.nodeId;
      this.notification.success('已设为补给站并添加推荐物资');
    }
  }

  onConsumptionRatesChange(rates: SupplyConsumptionRate[]): void {
    this.supplyService.setConsumptionRates(rates);
  }

  onDurationChange(hours: number): void {
    this.supplyService.setEstimatedDurationHours(hours);
  }

  onSupplySave(supplies: SupplyItem[]): void {
    if (!this.selectedSupplyNodeId) return;
    this.supplyService.updateNodeSupplies(this.selectedSupplyNodeId, supplies);
    this.notification.success('物资库存已更新');
  }

  onCommDeviceClick(device: CommDevice): void {
    this.selectedNodeId = device.nodeId;
    this.selectedSegmentId = null;
  }

  onCommNodeClick(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.selectedSegmentId = null;
  }

  onAddCommDevice(device: { type: CommDeviceType; nodeId: string }): void {
    const newDevice = {
      type: device.type,
      nodeId: device.nodeId,
      name: '',
      coverageRadius: 200,
      batteryLevel: 100,
      batteryCapacity: 100,
      signalStrength: 100,
      isOnline: true
    };
    this.commService.addCommDevice(newDevice);
    this.notification.success('通信设备已部署');
  }

  onToggleCommDevice(deviceId: string): void {
    this.commService.toggleCommDeviceOnline(deviceId);
    const device = this.commDevices.find(d => d.id === deviceId);
    if (device) {
      this.notification.info(device.isOnline ? '设备已下线' : '设备已上线');
    }
  }

  onDeleteCommDevice(deviceId: string): void {
    this.commService.deleteCommDevice(deviceId);
    this.notification.success('通信设备已删除');
  }

  onAddCommRelayRecommendation(recommendation: any): void {
    const nodeId = recommendation.nodeId || recommendation.id;
    const newDevice = {
      type: 'relay' as CommDeviceType,
      nodeId: nodeId,
      name: '',
      coverageRadius: 250,
      batteryLevel: 100,
      batteryCapacity: 100,
      signalStrength: 100,
      isOnline: true,
      maxConnections: 10,
      supportedChannels: 8
    };
    this.commService.addCommDevice(newDevice);
    this.notification.success('中继台已部署');
  }

  onCommDistressRouteClick(info: any): void {
    this.highlightPathNodes = info.pathToDistress || [];
    this.highlightPathSegments = info.pathSegments || [];
  }

  private getNodeName(nodeId: string): string {
    const node = this.nodes.find(n => n.id === nodeId);
    return node?.name || nodeId;
  }
}
