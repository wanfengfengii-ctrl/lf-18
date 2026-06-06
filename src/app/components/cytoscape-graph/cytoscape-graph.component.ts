import { Component, AfterViewInit, OnDestroy, Input, Output, EventEmitter, ElementRef, ViewChild, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import cytoscape, { Core, ElementDefinition, NodeSingular, EdgeSingular } from 'cytoscape';
import { CaveNode, RopeSegment, NODE_TYPE_MAP, RISK_LEVEL_MAP } from '../../models/cave-graph.model';
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

  @Output() nodeClick = new EventEmitter<string>();
  @Output() nodeDblClick = new EventEmitter<string>();
  @Output() segmentClick = new EventEmitter<string>();
  @Output() segmentDblClick = new EventEmitter<string>();
  @Output() nodeDragEnd = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() canvasClick = new EventEmitter<void>();
  @Output() addSegmentRequest = new EventEmitter<{ sourceId: string; targetId: string }>();

  private cy!: Core;
  private dangerAnimationTimer: any = null;

  constructor() {}

  ngAfterViewInit(): void {
    this.initCytoscape();
    this.renderGraph();
    this.setupEventListeners();
  }

  ngOnChanges(): void {
    if (this.cy) {
      this.renderGraph();
    }
  }

  ngOnDestroy(): void {
    this.stopDangerAnimation();
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
          'cursor': 'pointer'
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
          'border-width': 4
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
          'cursor': 'pointer'
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
          'target-arrow-color': '#00bcd4'
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
}
