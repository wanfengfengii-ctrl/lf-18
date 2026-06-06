import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import {
  CaveNode,
  RopeSegment,
  NodeType,
  RiskLevel,
  AnchorLoadInfo,
  PathResult,
  GraphAnalysis,
  NODE_TYPE_MAP
} from '../models/cave-graph.model';

@Injectable({
  providedIn: 'root'
})
export class CaveGraphService {
  private nodes$ = new BehaviorSubject<CaveNode[]>([]);
  private segments$ = new BehaviorSubject<RopeSegment[]>([]);

  private nextNodeId = 1;
  private nextSegmentId = 1;

  get nodes(): CaveNode[] {
    return this.nodes$.value;
  }

  get segments(): RopeSegment[] {
    return this.segments$.value;
  }

  getNodes(): Observable<CaveNode[]> {
    return this.nodes$.asObservable();
  }

  getSegments(): Observable<RopeSegment[]> {
    return this.segments$.asObservable();
  }

  addNode(node: Omit<CaveNode, 'id'> & { id?: string }): CaveNode {
    const id = node.id || `node-${this.nextNodeId++}`;
    if (this.nodes.some(n => n.id === id)) {
      throw new Error(`节点编号 ${id} 已存在，不能重复`);
    }
    const newNode: CaveNode = {
      id,
      name: node.name,
      type: node.type,
      description: node.description,
      x: node.x,
      y: node.y
    };
    const updated = [...this.nodes, newNode];
    this.nodes$.next(updated);
    return newNode;
  }

  updateNode(id: string, updates: Partial<Omit<CaveNode, 'id'>>): CaveNode | null {
    const index = this.nodes.findIndex(n => n.id === id);
    if (index === -1) return null;
    const updated = [...this.nodes];
    updated[index] = { ...updated[index], ...updates };
    this.nodes$.next(updated);
    return updated[index];
  }

  deleteNode(id: string): void {
    const updatedNodes = this.nodes.filter(n => n.id !== id);
    const updatedSegments = this.segments.filter(
      s => s.sourceId !== id && s.targetId !== id
    );
    this.nodes$.next(updatedNodes);
    this.segments$.next(updatedSegments);
  }

  addSegment(segment: Omit<RopeSegment, 'id'> & { id?: string }): RopeSegment {
    if (segment.length <= 0) {
      throw new Error('绳段长度必须大于零');
    }
    if (segment.sourceId === segment.targetId) {
      throw new Error('绳段不能连接同一个节点');
    }
    if (!this.nodes.find(n => n.id === segment.sourceId)) {
      throw new Error('起点节点不存在');
    }
    if (!this.nodes.find(n => n.id === segment.targetId)) {
      throw new Error('终点节点不存在');
    }
    const id = segment.id || `seg-${this.nextSegmentId++}`;
    if (this.segments.some(s => s.id === id)) {
      throw new Error(`绳段编号 ${id} 已存在`);
    }
    const newSegment: RopeSegment = {
      id,
      sourceId: segment.sourceId,
      targetId: segment.targetId,
      length: segment.length,
      slope: segment.slope,
      maxLoad: segment.maxLoad,
      riskLevel: segment.riskLevel,
      description: segment.description
    };
    const updated = [...this.segments, newSegment];
    this.segments$.next(updated);
    return newSegment;
  }

  updateSegment(id: string, updates: Partial<Omit<RopeSegment, 'id'>>): RopeSegment | null {
    const index = this.segments.findIndex(s => s.id === id);
    if (index === -1) return null;
    if (updates.length !== undefined && updates.length <= 0) {
      throw new Error('绳段长度必须大于零');
    }
    const updated = [...this.segments];
    updated[index] = { ...updated[index], ...updates };
    this.segments$.next(updated);
    return updated[index];
  }

  deleteSegment(id: string): void {
    const updated = this.segments.filter(s => s.id !== id);
    this.segments$.next(updated);
  }

  getNodeById(id: string): CaveNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  getSegmentById(id: string): RopeSegment | undefined {
    return this.segments.find(s => s.id === id);
  }

  isNodeIdExists(id: string): boolean {
    return this.nodes.some(n => n.id === id);
  }

  getAnchorLoads(): AnchorLoadInfo[] {
    const anchors = this.nodes.filter(n => n.type === 'anchor');
    return anchors.map(anchor => {
      const connectedSegments = this.segments.filter(
        s => s.sourceId === anchor.id || s.targetId === anchor.id
      );
      const totalLoad = connectedSegments.reduce((sum, s) => sum + s.maxLoad, 0);
      const anchorMaxLoad = anchor.maxLoad ?? 0;
      return {
        nodeId: anchor.id,
        nodeName: anchor.name,
        totalLoad: totalLoad,
        maxLoad: anchorMaxLoad,
        isOverloaded: anchorMaxLoad > 0 && totalLoad > anchorMaxLoad,
        connectedSegments: connectedSegments.map(s => s.id)
      };
    });
  }

  checkSegmentOverload(
    sourceId: string,
    targetId: string,
    segmentMaxLoad: number,
    excludeSegmentId?: string
  ): { overloadedAnchors: { nodeId: string; nodeName: string; totalLoad: number; maxLoad: number }[] } {
    const overloadedAnchors: { nodeId: string; nodeName: string; totalLoad: number; maxLoad: number }[] = [];
    const nodeIdsToCheck = [sourceId, targetId];

    for (const nodeId of nodeIdsToCheck) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'anchor' || !node.maxLoad) continue;

      const connectedSegments = this.segments.filter(
        s => (s.sourceId === nodeId || s.targetId === nodeId) && s.id !== excludeSegmentId
      );
      const existingLoad = connectedSegments.reduce((sum, s) => sum + s.maxLoad, 0);
      const totalLoad = existingLoad + segmentMaxLoad;

      if (totalLoad > node.maxLoad) {
        overloadedAnchors.push({
          nodeId: node.id,
          nodeName: node.name,
          totalLoad,
          maxLoad: node.maxLoad
        });
      }
    }

    return { overloadedAnchors };
  }

  findPathsToEntrance(fromNodeId: string): PathResult[] {
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance').map(n => n.id);
    if (entranceNodes.length === 0) return [];
    if (entranceNodes.includes(fromNodeId)) {
      return [{ path: [fromNodeId], totalLength: 0, maxRisk: 'low' }];
    }

    const results: PathResult[] = [];
    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList();

    const dfs = (currentId: string, path: string[], totalLength: number, maxRisk: RiskLevel) => {
      if (entranceNodes.includes(currentId)) {
        results.push({ path: [...path], totalLength, maxRisk });
        return;
      }
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const neighbors = adjacency.get(currentId) || [];
      for (const { targetId, segment } of neighbors) {
        if (!visited.has(targetId)) {
          const newRisk = this.maxRiskLevel(maxRisk, segment.riskLevel);
          dfs(targetId, [...path, targetId], totalLength + segment.length, newRisk);
        }
      }
      visited.delete(currentId);
    };

    dfs(fromNodeId, [fromNodeId], 0, 'low');
    return results.sort((a, b) => a.totalLength - b.totalLength);
  }

  getDisconnectedNodes(): string[] {
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance').map(n => n.id);
    if (entranceNodes.length === 0) {
      return this.nodes.map(n => n.id);
    }

    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList();
    const queue = [...entranceNodes];
    entranceNodes.forEach(id => visited.add(id));

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];
      for (const { targetId } of neighbors) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push(targetId);
        }
      }
    }

    return this.nodes.filter(n => !visited.has(n.id)).map(n => n.id);
  }

  getAnalysis(): Observable<GraphAnalysis> {
    return combineLatest([this.nodes$, this.segments$]).pipe(
      map(([nodes, segments]) => {
        const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
        const overloadedAnchors = this.getAnchorLoads().filter(a => a.isOverloaded);
        const disconnectedNodes = this.getDisconnectedNodes();
        const entranceNodes = nodes.filter(n => n.type === 'entrance').map(n => n.id);

        return {
          totalLength,
          nodeCount: nodes.length,
          segmentCount: segments.length,
          overloadedAnchors,
          disconnectedNodes,
          entranceNodes
        };
      })
    );
  }

  private buildAdjacencyList(): Map<string, { targetId: string; segment: RopeSegment }[]> {
    const adjacency = new Map<string, { targetId: string; segment: RopeSegment }[]>();
    for (const segment of this.segments) {
      if (!adjacency.has(segment.sourceId)) {
        adjacency.set(segment.sourceId, []);
      }
      if (!adjacency.has(segment.targetId)) {
        adjacency.set(segment.targetId, []);
      }
      adjacency.get(segment.sourceId)!.push({ targetId: segment.targetId, segment });
      adjacency.get(segment.targetId)!.push({ targetId: segment.sourceId, segment });
    }
    return adjacency;
  }

  private riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  private maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
    return this.riskOrder[a] >= this.riskOrder[b] ? a : b;
  }

  clearAll(): void {
    this.nodes$.next([]);
    this.segments$.next([]);
    this.nextNodeId = 1;
    this.nextSegmentId = 1;
  }

  loadSampleData(): void {
    this.clearAll();

    const sampleNodes: CaveNode[] = [
      { id: 'entrance-1', name: '主入口', type: 'entrance', x: 400, y: 100, description: '洞穴主入口' },
      { id: 'anchor-1', name: '入口锚点', type: 'anchor', x: 400, y: 180, description: '入口第一锚点', maxLoad: 350 },
      { id: 'platform-1', name: '第一平台', type: 'platform', x: 300, y: 280, description: '下降后第一平台' },
      { id: 'shaft-1', name: '一号竖井', type: 'shaft', x: 500, y: 350, description: '深约25米的竖井' },
      { id: 'anchor-2', name: '竖井锚点', type: 'anchor', x: 500, y: 280, description: '竖井顶部锚点', maxLoad: 500 },
      { id: 'platform-2', name: '地下大厅', type: 'platform', x: 500, y: 500, description: '宽阔的地下大厅' },
      { id: 'danger-1', name: '落石区', type: 'danger', x: 250, y: 400, description: '不稳定岩层区域' },
      { id: 'anchor-3', name: '分支锚点', type: 'anchor', x: 650, y: 450, description: '分支路线锚点', maxLoad: 300 },
      { id: 'platform-3', name: '东侧平台', type: 'platform', x: 750, y: 380, description: '东侧分支平台' }
    ];

    const sampleSegments: RopeSegment[] = [
      { id: 'seg-1', sourceId: 'entrance-1', targetId: 'anchor-1', length: 15, slope: 45, maxLoad: 200, riskLevel: 'low', description: '入口下降绳' },
      { id: 'seg-2', sourceId: 'anchor-1', targetId: 'platform-1', length: 20, slope: 30, maxLoad: 200, riskLevel: 'low', description: '斜向下降' },
      { id: 'seg-3', sourceId: 'platform-1', targetId: 'anchor-2', length: 30, slope: 0, maxLoad: 150, riskLevel: 'medium', description: '水平横移' },
      { id: 'seg-4', sourceId: 'anchor-2', targetId: 'shaft-1', length: 25, slope: 90, maxLoad: 300, riskLevel: 'high', description: '竖井主绳' },
      { id: 'seg-5', sourceId: 'shaft-1', targetId: 'platform-2', length: 10, slope: 10, maxLoad: 200, riskLevel: 'low', description: '竖井底部' },
      { id: 'seg-6', sourceId: 'platform-2', targetId: 'anchor-3', length: 18, slope: 20, maxLoad: 180, riskLevel: 'medium', description: '分支路线' },
      { id: 'seg-7', sourceId: 'anchor-3', targetId: 'platform-3', length: 22, slope: 15, maxLoad: 200, riskLevel: 'low', description: '东侧分支' },
      { id: 'seg-8', sourceId: 'platform-1', targetId: 'danger-1', length: 12, slope: 5, maxLoad: 100, riskLevel: 'high', description: '通往落石区' }
    ];

    this.nodes$.next(sampleNodes);
    this.segments$.next(sampleSegments);
    this.nextNodeId = 10;
    this.nextSegmentId = 10;
  }
}
