import { Component, AfterViewInit, OnDestroy, Input, Output, EventEmitter, ElementRef, ViewChild, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import cytoscape, { Core, ElementDefinition, NodeSingular, EdgeSingular } from 'cytoscape';
import { CaveNode, RopeSegment, NODE_TYPE_MAP, RISK_LEVEL_MAP, GraphHighlight } from '../../models/cave-graph.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cytoscape-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #cyContainer class="cy-container"></div>
  `,
  styles: [`
    .cy-container {
      width: 100%;
      height: 100%;
      position: relative;
      background: #1a1a2e;
      background-image:
        radial-gradient(circle at 20% 30%, rgba(100, 100, 200, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(100, 100, 200, 0.1) 0%, transparent 50%);
    }
  `]
})
export class CytoscapeGraphComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef;

  @Input() nodes: CaveNode[] = [];
  @Input() segments: RopeSegment[] = [];
  @Input() selectedNodeId: string | null = null;
  @Input() selectedSegmentId: string | null = null;
  @Input() disconnectedNodes: string[] = [];
  @Input() overloadAnchors: string[] = [];
  @Input() highlights: GraphHighlight | null = null;
  @Input() highlightPath: string[] = [];
  @Input() highlightPathSegments: string[] = [];
  @Input() blockedNodes: string[] = [];
  @Input() blockedSegments: string[] = [];
  @Input() simulatedRemovedNodes: string[] = [];
  @Input() simulatedRemovedSegments: string[] = [];
  @Input() isSimulationMode: boolean = false;

  @Output() nodeClick = new EventEmitter<string>();
  @Output() nodeDblClick = new EventEmitter<string>();
  @Output() segmentClick = new EventEmitter<string>();
  @Output() segmentDblClick = new EventEmitter<string>();
  @Output() nodeDragEnd = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() canvasClick = new EventEmitter<void>();
  @Output() addSegmentRequest = new EventEmitter<{ sourceId: string; targetId: string }>();

  private cy!: Core;
  private dangerAnimationTimer: any = null;
  private pulseAnimationTimer: any = null;

  constructor() {}

  ngAfterViewInit(): void {
    this.initCytoscape();
    this.renderGraph();
    this.setupEventListeners();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.cy) {
      this.renderGraph();
    }
  }

  ngOnDestroy(): void {
    this.stopDangerAnimation();
    this.stopPulseAnimation();
    if (this.cy) {
      this.cy.destroy();
    }
  }

  private getGraphStyle(): any[] {
    return [
      {
        selector: 'node',
        style: {
          'background-color': '#666',
          'label': 'data(label)',
          'color': '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          'text-outline-width': 2,
          'text-outline-color': '#000',
          'width': 50,
          'height': 50,
          'border-width': 3,
          'border-color': '#fff',
          'cursor': 'pointer',
          'opacity': 1
        }
      },
      {
        selector: 'node.entrance',
        style: {
          'background-color': NODE_TYPE_MAP.entrance.color,
          'shape': 'round-rectangle',
          'width': 60,
          'height': 40
        }
      },
      {
        selector: 'node.platform',
        style: {
          'background-color': NODE_TYPE_MAP.platform.color,
          'shape': 'round-rectangle'
        }
      },
      {
        selector: 'node.shaft',
        style: {
          'background-color': NODE_TYPE_MAP.shaft.color,
          'shape': 'ellipse',
          'width': 55,
          'height': 55
        }
      },
      {
        selector: 'node.anchor',
        style: {
          'background-color': NODE_TYPE_MAP.anchor.color,
          'shape': 'diamond',
          'width': 40,
          'height': 40
        }
      },
      {
        selector: 'node.danger',
        style: {
          'background-color': NODE_TYPE_MAP.danger.color,
          'shape': 'triangle',
          'width': 60,
          'height': 60,
          'border-color': '#ffeb3b',
          'border-width': 5,
          'border-style': 'double',
          'color': '#fff',
          'text-outline-width': 3,
          'text-outline-color': '#b71c1c',
          'font-weight': 'bold',
          'font-size': '11px'
        }
      },
      {
        selector: 'node.disconnected',
        style: {
          'border-color': '#ff0000',
          'border-width': 4,
          'border-style': 'double'
        }
      },
      {
        selector: 'node.overloaded',
        style: {
          'border-color': '#ff6b00',
          'border-width': 4,
          'border-style': 'solid'
        }
      },
      {
        selector: 'node.selected',
        style: {
          'border-color': '#00bcd4',
          'border-width': 5,
          'border-style': 'solid',
          'z-index': 10
        }
      },
      {
        selector: 'node.connecting',
        style: {
          'border-color': '#00ff00',
          'border-width': 4
        }
      },
      {
        selector: 'node.key-anchor',
        style: {
          'border-color': '#9c27b0',
          'border-width': 5,
          'border-style': 'solid',
          'shadow-color': '#9c27b0',
          'shadow-blur': 15,
          'shadow-opacity': 0.8
        }
      },
      {
        selector: 'node.blocked',
        style: {
          'opacity': 0.3,
          'border-color': '#9e9e9e',
          'border-style': 'dashed'
        }
      },
      {
        selector: 'node.sim-removed',
        style: {
          'opacity': 0.2,
          'border-color': '#f44336',
          'border-style': 'dashed',
          'border-width': 3
        }
      },
      {
        selector: 'node.safe-route',
        style: {
          'border-color': '#00e676',
          'border-width': 5,
          'border-style': 'solid',
          'shadow-color': '#00e676',
          'shadow-blur': 12,
          'shadow-opacity': 0.6
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#888',
          'target-arrow-color': '#888',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'color': '#fff',
          'text-outline-width': 2,
          'text-outline-color': '#000',
          'text-background-color': '#333',
          'text-background-opacity': 0.8,
          'text-background-padding': '3px',
          'cursor': 'pointer',
          'opacity': 1,
          'arrow-scale': 1
        }
      },
      {
        selector: 'edge.risk-low',
        style: { 'line-color': RISK_LEVEL_MAP.low.color, 'target-arrow-color': RISK_LEVEL_MAP.low.color }
      },
      {
        selector: 'edge.risk-medium',
        style: { 'line-color': RISK_LEVEL_MAP.medium.color, 'target-arrow-color': RISK_LEVEL_MAP.medium.color }
      },
      {
        selector: 'edge.risk-high',
        style: { 'line-color': RISK_LEVEL_MAP.high.color, 'target-arrow-color': RISK_LEVEL_MAP.high.color }
      },
      {
        selector: 'edge.risk-critical',
        style: {
          'line-color': RISK_LEVEL_MAP.critical.color,
          'target-arrow-color': RISK_LEVEL_MAP.critical.color,
          'width': 5,
          'line-style': 'dashed'
        }
      },
      {
        selector: 'edge.selected',
        style: {
          'width': 5,
          'line-color': '#00bcd4',
          'target-arrow-color': '#00bcd4',
          'z-index': 10
        }
      },
      {
        selector: 'edge.bottleneck',
        style: {
          'width': 6,
          'line-color': '#ff9800',
          'target-arrow-color': '#ff9800',
          'line-style': 'dotted',
          'shadow-color': '#ff9800',
          'shadow-blur': 8,
          'shadow-opacity': 0.6
        }
      },
      {
        selector: 'edge.blocked',
        style: {
          'opacity': 0.2,
          'line-style': 'dashed',
          'line-color': '#9e9e9e',
          'target-arrow-color': '#9e9e9e'
        }
      },
      {
        selector: 'edge.sim-removed',
        style: {
          'opacity': 0.15,
          'line-style': 'dashed',
          'line-color': '#f44336',
          'target-arrow-color': '#f44336'
        }
      },
      {
        selector: 'edge.safe-route',
        style: {
          'width': 6,
          'line-color': '#00e676',
          'target-arrow-color': '#00e676',
          'shadow-color': '#00e676',
          'shadow-blur': 10,
          'shadow-opacity': 0.7,
          'z-index': 5
        }
      },
      {
        selector: 'edge.directional',
        style: {
          'target-arrow-shape': 'triangle',
          'arrow-scale': 1.2
        }
      },
      {
        selector: 'edge.directional-reverse',
        style: {
          'source-arrow-shape': 'triangle',
          'source-arrow-color': 'data(line-color)',
          'arrow-scale': 1.2
        }
      }
    ];
  }

  private initCytoscape(): void {
    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      style: this.getGraphStyle(),
      wheelSensitivity: 0.3
    });
  }

  private renderGraph(): void {
    if (!this.cy) return;

    const elements: ElementDefinition[] = [];

    for (const node of this.nodes) {
      const classes: string[] = [node.type];

      if (this.disconnectedNodes.includes(node.id)) {
        classes.push('disconnected');
      }
      if (this.overloadAnchors.includes(node.id)) {
        classes.push('overloaded');
      }
      if (this.selectedNodeId === node.id) {
        classes.push('selected');
      }
      if (this.highlights?.keyAnchors.includes(node.id)) {
        classes.push('key-anchor');
      }
      if (node.isBlocked || this.blockedNodes.includes(node.id)) {
        classes.push('blocked');
      }
      if (this.isSimulationMode && this.simulatedRemovedNodes.includes(node.id)) {
        classes.push('sim-removed');
      }
      if (this.highlightPath.includes(node.id)) {
        classes.push('safe-route');
      }

      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.name
        },
        position: { x: node.x, y: node.y },
        classes: classes.join(' ')
      });
    }

    for (const segment of this.segments) {
      const classes: string[] = [`risk-${segment.riskLevel}`];

      if (this.selectedSegmentId === segment.id) {
        classes.push('selected');
      }
      if (this.highlights?.bottleneckSegments.includes(segment.id)) {
        classes.push('bottleneck');
      }
      if (segment.isBlocked || this.blockedSegments.includes(segment.id)) {
        classes.push('blocked');
      }
      if (this.isSimulationMode && this.simulatedRemovedSegments.includes(segment.id)) {
        classes.push('sim-removed');
      }
      if (this.highlightPathSegments.includes(segment.id)) {
        classes.push('safe-route');
      }

      if (segment.traversalDirection === 'sourceToTarget') {
        classes.push('directional');
      } else if (segment.traversalDirection === 'targetToSource') {
        classes.push('directional-reverse');
      }

      elements.push({
        group: 'edges',
        data: {
          id: segment.id,
          source: segment.sourceId,
          target: segment.targetId,
          label: `${segment.length}m`
        },
        classes: classes.join(' ')
      });
    }

    this.cy.elements().remove();
    this.cy.add(elements);

    this.restartDangerAnimation();
    this.restartPulseAnimation();
  }

  private setupEventListeners(): void {
    this.cy.on('tap', 'node', (event) => {
      const node = event.target as NodeSingular;
      this.nodeClick.emit(node.id());
    });

    this.cy.on('dbltap', 'node', (event) => {
      const node = event.target as NodeSingular;
      this.nodeDblClick.emit(node.id());
    });

    this.cy.on('tap', 'edge', (event) => {
      const edge = event.target as EdgeSingular;
      this.segmentClick.emit(edge.id());
    });

    this.cy.on('dbltap', 'edge', (event) => {
      const edge = event.target as EdgeSingular;
      this.segmentDblClick.emit(edge.id());
    });

    this.cy.on('tap', (event) => {
      if (event.target === this.cy) {
        this.canvasClick.emit();
      }
    });

    this.cy.on('dragfree', 'node', (event) => {
      const node = event.target as NodeSingular;
      const pos = node.position();
      this.nodeDragEnd.emit({ id: node.id(), x: pos.x, y: pos.y });
    });
  }

  fit(): void {
    if (this.cy) {
      this.cy.fit(undefined, 50);
    }
  }

  center(): void {
    if (this.cy) {
      this.cy.center();
    }
  }

  zoom(level: number): void {
    if (this.cy) {
      this.cy.zoom(level);
    }
  }

  highlightPathNodes(nodeIds: string[], segmentIds: string[]): void {
    if (!this.cy) return;

    this.cy.nodes().removeClass('safe-route');
    this.cy.edges().removeClass('safe-route');

    for (const nodeId of nodeIds) {
      const node = this.cy.getElementById(nodeId);
      if (node.length > 0) {
        node.addClass('safe-route');
      }
    }

    for (const segId of segmentIds) {
      const edge = this.cy.getElementById(segId);
      if (edge.length > 0) {
        edge.addClass('safe-route');
      }
    }
  }

  clearPathHighlight(): void {
    if (!this.cy) return;
    this.cy.nodes().removeClass('safe-route');
    this.cy.edges().removeClass('safe-route');
  }

  private startDangerAnimation(): void {
    this.stopDangerAnimation();
    let phase = 0;

    const animate = () => {
      if (!this.cy) return;
      phase += 0.08;
      const pulse = 0.5 + 0.5 * Math.sin(phase);
      const borderWidth = 3 + pulse * 5;
      const sizeScale = 1 + pulse * 0.15;

      const dangerNodes = this.cy.nodes('node.danger');
      if (dangerNodes.length > 0) {
        dangerNodes.style('border-width', `${borderWidth}px`);
        dangerNodes.style('width', `${60 * sizeScale}px`);
        dangerNodes.style('height', `${60 * sizeScale}px`);

        if (pulse > 0.7) {
          dangerNodes.style('border-color', '#ffeb3b');
        } else {
          dangerNodes.style('border-color', '#f44336');
        }
      }

      this.dangerAnimationTimer = requestAnimationFrame(animate);
    };

    this.dangerAnimationTimer = requestAnimationFrame(animate);
  }

  private stopDangerAnimation(): void {
    if (this.dangerAnimationTimer) {
      cancelAnimationFrame(this.dangerAnimationTimer);
      this.dangerAnimationTimer = null;
    }
  }

  private restartDangerAnimation(): void {
    if (this.nodes.some(n => n.type === 'danger')) {
      this.startDangerAnimation();
    } else {
      this.stopDangerAnimation();
    }
  }

  private startPulseAnimation(): void {
    this.stopPulseAnimation();
    let phase = 0;

    const animate = () => {
      if (!this.cy) return;
      phase += 0.05;
      const pulse = 0.5 + 0.5 * Math.sin(phase);

      const keyAnchors = this.cy.nodes('node.key-anchor');
      if (keyAnchors.length > 0) {
        const shadowBlur = 10 + pulse * 10;
        keyAnchors.style('shadow-blur', `${shadowBlur}px`);
      }

      const bottleneckEdges = this.cy.edges('edge.bottleneck');
      if (bottleneckEdges.length > 0) {
        const width = 4 + pulse * 4;
        bottleneckEdges.style('width', `${width}px`);
      }

      const safeRouteNodes = this.cy.nodes('node.safe-route');
      if (safeRouteNodes.length > 0) {
        const shadowBlur = 8 + pulse * 8;
        safeRouteNodes.style('shadow-blur', `${shadowBlur}px`);
      }

      const safeRouteEdges = this.cy.edges('edge.safe-route');
      if (safeRouteEdges.length > 0) {
        const width = 4 + pulse * 4;
        safeRouteEdges.style('width', `${width}px`);
      }

      this.pulseAnimationTimer = requestAnimationFrame(animate);
    };

    this.pulseAnimationTimer = requestAnimationFrame(animate);
  }

  private stopPulseAnimation(): void {
    if (this.pulseAnimationTimer) {
      cancelAnimationFrame(this.pulseAnimationTimer);
      this.pulseAnimationTimer = null;
    }
  }

  private restartPulseAnimation(): void {
    const hasKeyAnchors = this.highlights?.keyAnchors && this.highlights.keyAnchors.length > 0;
    const hasBottlenecks = this.highlights?.bottleneckSegments && this.highlights.bottleneckSegments.length > 0;
    const hasSafeRoute = this.highlightPath.length > 0 || this.highlightPathSegments.length > 0;

    if (hasKeyAnchors || hasBottlenecks || hasSafeRoute) {
      this.startPulseAnimation();
    } else {
      this.stopPulseAnimation();
    }
  }
}
