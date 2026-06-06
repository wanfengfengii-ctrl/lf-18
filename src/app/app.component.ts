import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CaveGraphService } from './services/cave-graph.service';
import { CaveNode, RopeSegment, GraphAnalysis, PathResult, NODE_TYPE_MAP } from './models/cave-graph.model';
import { CytoscapeGraphComponent } from './components/cytoscape-graph/cytoscape-graph.component';
import { NodeEditorComponent } from './components/node-editor/node-editor.component';
import { SegmentEditorComponent } from './components/segment-editor/segment-editor.component';
import { StatsPanelComponent } from './components/stats-panel/stats-panel.component';
import { PathAnalysisComponent } from './components/path-analysis/path-analysis.component';
import { OverloadConfirmDialogComponent } from './components/overload-confirm-dialog/overload-confirm-dialog.component';

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
    MatSnackBarModule,
    MatDialogModule,
    CytoscapeGraphComponent,
    NodeEditorComponent,
    SegmentEditorComponent,
    StatsPanelComponent,
    PathAnalysisComponent
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
                    (nodeClick)="onNodeClick($event)"
                  ></app-stats-panel>
                  <app-path-analysis
                    [nodeOptions]="nodeOptions"
                    [paths]="selectedPaths"
                    [nodeNames]="nodeNames"
                    (nodeSelect)="onPathNodeSelect($event)"
                  ></app-path-analysis>
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
    }
    .side-panel {
      width: 360px;
      min-width: 360px;
    }
    .sidenav {
      width: 360px;
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
  `]
})
export class AppComponent implements OnInit {
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

  readonly legendItems = [
    { label: '入口', color: NODE_TYPE_MAP.entrance.color, shape: 'square' },
    { label: '平台', color: NODE_TYPE_MAP.platform.color, shape: 'square' },
    { label: '竖井', color: NODE_TYPE_MAP.shaft.color, shape: 'round' },
    { label: '锚点', color: NODE_TYPE_MAP.anchor.color, shape: 'round' },
    { label: '危险区域', color: NODE_TYPE_MAP.danger.color, shape: 'round' }
  ];

  constructor(
    private caveGraphService: CaveGraphService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.caveGraphService.getNodes().subscribe(nodes => {
      this.nodes = nodes;
    });

    this.caveGraphService.getSegments().subscribe(segments => {
      this.segments = segments;
    });

    this.caveGraphService.getAnalysis().subscribe(analysis => {
      this.analysis = analysis;
      this.disconnectedNodes = analysis.disconnectedNodes;
      this.overloadAnchors = analysis.overloadedAnchors.map(a => a.nodeId);
    });
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

  get nodeOptions(): { id: string; name: string }[] {
    return this.nodes.map(n => ({ id: n.id, name: n.name }));
  }

  onNodeClick(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.selectedSegmentId = null;
    this.showNodeForm = false;
    this.showSegmentForm = false;
    this.selectedPaths = this.caveGraphService.findPathsToEntrance(nodeId);
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
    if (!this.showNodeForm && !this.showSegmentForm) {
    }
  }

  onNodeDragEnd(event: { id: string; x: number; y: number }): void {
    this.caveGraphService.updateNode(event.id, { x: event.x, y: event.y });
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
      this.showSnackBar('至少需要两个节点才能添加绳段');
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
        this.caveGraphService.updateNode(node.id, {
          name: node.name,
          type: node.type,
          description: node.description
        });
        this.showSnackBar('节点已更新');
      } else {
        this.caveGraphService.addNode(node);
        this.selectedNodeId = node.id;
        this.showNodeForm = false;
        this.showSnackBar('节点已添加');
      }
    } catch (e: any) {
      this.showSnackBar(e.message || '操作失败');
    }
  }

  onDeleteNode(nodeId: string): void {
    if (confirm('确定要删除此节点吗？相关联的绳段也将被删除。')) {
      this.caveGraphService.deleteNode(nodeId);
      this.selectedNodeId = null;
      this.showSnackBar('节点已删除');
    }
  }

  onSaveSegment(segment: RopeSegment): void {
    try {
      const overloadCheck = this.caveGraphService.checkSegmentOverload(
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
      this.showSnackBar(e.message || '操作失败');
    }
  }

  private doSaveSegment(segment: RopeSegment): void {
    try {
      if (this.selectedSegmentId) {
        this.caveGraphService.updateSegment(segment.id, {
          sourceId: segment.sourceId,
          targetId: segment.targetId,
          length: segment.length,
          slope: segment.slope,
          maxLoad: segment.maxLoad,
          riskLevel: segment.riskLevel,
          description: segment.description
        });
        this.showSnackBar('绳段已更新');
      } else {
        const newSeg = this.caveGraphService.addSegment(segment);
        this.selectedSegmentId = newSeg.id;
        this.showSegmentForm = false;
        this.showSnackBar('绳段已添加');
      }
    } catch (e: any) {
      this.showSnackBar(e.message || '操作失败');
    }
  }

  onDeleteSegment(segmentId: string): void {
    if (confirm('确定要删除此绳段吗？')) {
      this.caveGraphService.deleteSegment(segmentId);
      this.selectedSegmentId = null;
      this.showSnackBar('绳段已删除');
    }
  }

  onCancelEdit(): void {
    this.showNodeForm = false;
    this.showSegmentForm = false;
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
  }

  onPathNodeSelect(nodeId: string): void {
    this.selectedPaths = this.caveGraphService.findPathsToEntrance(nodeId);
    this.selectedNodeId = nodeId;
    this.selectedSegmentId = null;
  }

  onLoadSample(): void {
    this.caveGraphService.loadSampleData();
    this.selectedNodeId = null;
    this.selectedSegmentId = null;
    this.showNodeForm = false;
    this.showSegmentForm = false;
    this.showSnackBar('示例数据已加载');
    setTimeout(() => {
      if (this.graphComponent) {
        this.graphComponent.fit();
      }
    }, 100);
  }

  onClearAll(): void {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      this.caveGraphService.clearAll();
      this.selectedNodeId = null;
      this.selectedSegmentId = null;
      this.selectedPaths = [];
      this.showSnackBar('所有数据已清空');
    }
  }

  onFit(): void {
    if (this.graphComponent) {
      this.graphComponent.fit();
    }
  }

  private showSnackBar(message: string): void {
    this.snackBar.open(message, '关闭', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
