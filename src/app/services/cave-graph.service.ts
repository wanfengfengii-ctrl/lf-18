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
  NODE_TYPE_MAP,
  TeamConfig,
  TeamMember,
  AnchorDynamicLoad,
  RouteVersion,
  RouteComparison,
  SimulationResult,
  GraphHighlight,
  TraversalDirection
} from '../models/cave-graph.model';

@Injectable({
  providedIn: 'root'
})
export class CaveGraphService {
  private nodes$ = new BehaviorSubject<CaveNode[]>([]);
  private segments$ = new BehaviorSubject<RopeSegment[]>([]);
  private teamConfig$ = new BehaviorSubject<TeamConfig>({
    members: [],
    passingOrder: [],
    safetyFactor: 1.5
  });
  private routeVersions$ = new BehaviorSubject<RouteVersion[]>([]);
  private simulationMode$ = new BehaviorSubject<boolean>(false);
  private simulatedRemovedNodes$ = new BehaviorSubject<string[]>([]);
  private simulatedRemovedSegments$ = new BehaviorSubject<string[]>([]);

  private nextNodeId = 1;
  private nextSegmentId = 1;
  private nextVersionId = 1;
  private nextMemberId = 1;

  get nodes(): CaveNode[] {
    return this.nodes$.value;
  }

  get segments(): RopeSegment[] {
    return this.segments$.value;
  }

  get teamConfig(): TeamConfig {
    return this.teamConfig$.value;
  }

  get routeVersions(): RouteVersion[] {
    return this.routeVersions$.value;
  }

  get isSimulationMode(): boolean {
    return this.simulationMode$.value;
  }

  get simulatedRemovedNodes(): string[] {
    return this.simulatedRemovedNodes$.value;
  }

  get simulatedRemovedSegments(): string[] {
    return this.simulatedRemovedSegments$.value;
  }

  getNodes(): Observable<CaveNode[]> {
    return this.nodes$.asObservable();
  }

  getSegments(): Observable<RopeSegment[]> {
    return this.segments$.asObservable();
  }

  getTeamConfig(): Observable<TeamConfig> {
    return this.teamConfig$.asObservable();
  }

  getRouteVersions(): Observable<RouteVersion[]> {
    return this.routeVersions$.asObservable();
  }

  getSimulationMode(): Observable<boolean> {
    return this.simulationMode$.asObservable();
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
      y: node.y,
      maxLoad: node.maxLoad,
      isBlocked: node.isBlocked || false
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

  toggleNodeBlocked(id: string): void {
    const node = this.nodes.find(n => n.id === id);
    if (node) {
      this.updateNode(id, { isBlocked: !node.isBlocked });
    }
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
      description: segment.description,
      traversalDirection: segment.traversalDirection || 'bidirectional',
      isBlocked: segment.isBlocked || false
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

  toggleSegmentBlocked(id: string): void {
    const segment = this.segments.find(s => s.id === id);
    if (segment) {
      this.updateSegment(id, { isBlocked: !segment.isBlocked });
    }
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
    const anchors = this.nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    return anchors.map(anchor => {
      const connectedSegments = this.segments.filter(
        s => !s.isBlocked && (s.sourceId === anchor.id || s.targetId === anchor.id)
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

  getDynamicAnchorLoads(): AnchorDynamicLoad[] {
    const team = this.teamConfig;
    const totalTeamWeight = team.members.reduce(
      (sum, m) => sum + m.weight + m.equipmentWeight, 0
    ) * team.safetyFactor;

    const anchors = this.nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    return anchors.map(anchor => {
      const connectedSegments = this.segments.filter(
        s => !s.isBlocked && (s.sourceId === anchor.id || s.targetId === anchor.id)
      );
      const staticLoad = connectedSegments.reduce((sum, s) => sum + s.maxLoad, 0);
      const dynamicLoad = staticLoad + totalTeamWeight;
      const maxLoad = anchor.maxLoad ?? 0;
      const utilization = maxLoad > 0 ? (dynamicLoad / maxLoad) * 100 : 0;

      return {
        nodeId: anchor.id,
        nodeName: anchor.name,
        staticLoad,
        dynamicLoad,
        maxLoad,
        utilization,
        isOverloaded: maxLoad > 0 && dynamicLoad > maxLoad,
        peakLoadMembers: this.calculatePeakLoadMembers(anchor.id)
      };
    });
  }

  private calculatePeakLoadMembers(anchorId: string): string[] {
    const team = this.teamConfig;
    const connectedSegments = this.segments.filter(
      s => !s.isBlocked && (s.sourceId === anchorId || s.targetId === anchorId)
    );

    if (connectedSegments.length === 0 || team.members.length === 0) return [];

    const peakMembers: string[] = [];
    const sortedMembers = [...team.members].sort(
      (a, b) => (b.weight + b.equipmentWeight) - (a.weight + a.equipmentWeight)
    );

    const segmentCount = Math.min(connectedSegments.length, sortedMembers.length);
    for (let i = 0; i < segmentCount; i++) {
      peakMembers.push(sortedMembers[i].name);
    }

    return peakMembers;
  }

  setTeamConfig(config: TeamConfig): void {
    this.teamConfig$.next({ ...config });
  }

  addTeamMember(member: Omit<TeamMember, 'id'>): TeamMember {
    const id = `member-${this.nextMemberId++}`;
    const newMember: TeamMember = { id, ...member };
    const config = this.teamConfig;
    this.teamConfig$.next({
      ...config,
      members: [...config.members, newMember],
      passingOrder: [...config.passingOrder, id]
    });
    return newMember;
  }

  updateTeamMember(id: string, updates: Partial<TeamMember>): void {
    const config = this.teamConfig;
    const members = config.members.map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    this.teamConfig$.next({ ...config, members });
  }

  removeTeamMember(id: string): void {
    const config = this.teamConfig;
    this.teamConfig$.next({
      ...config,
      members: config.members.filter(m => m.id !== id),
      passingOrder: config.passingOrder.filter(mid => mid !== id)
    });
  }

  setPassingOrder(order: string[]): void {
    const config = this.teamConfig;
    this.teamConfig$.next({ ...config, passingOrder: order });
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
        s => (s.sourceId === nodeId || s.targetId === nodeId) && s.id !== excludeSegmentId && !s.isBlocked
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

  findPathsToEntrance(fromNodeId: string, options?: { useRiskWeight?: boolean; considerBlocked?: boolean }): PathResult[] {
    const useRiskWeight = options?.useRiskWeight ?? false;
    const considerBlocked = options?.considerBlocked ?? true;

    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && (!considerBlocked || !n.isBlocked)).map(n => n.id);
    if (entranceNodes.length === 0) return [];
    if (entranceNodes.includes(fromNodeId)) {
      return [{ path: [fromNodeId], totalLength: 0, maxRisk: 'low', riskScore: 0, avgRisk: 0, segments: [] }];
    }

    const results: PathResult[] = [];
    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList(considerBlocked);

    const dfs = (currentId: string, path: string[], segPath: string[], totalLength: number, maxRisk: RiskLevel, totalRisk: number, depth: number) => {
      if (entranceNodes.includes(currentId)) {
        results.push({
          path: [...path],
          totalLength,
          maxRisk,
          riskScore: this.calculateRiskScore(totalLength, maxRisk),
          avgRisk: depth > 0 ? totalRisk / depth : 0,
          segments: [...segPath]
        });
        return;
      }
      if (visited.has(currentId)) return;
      if (depth > 50) return;
      visited.add(currentId);

      const neighbors = adjacency.get(currentId) || [];
      for (const { targetId, segment } of neighbors) {
        if (!visited.has(targetId)) {
          const newRisk = this.maxRiskLevel(maxRisk, segment.riskLevel);
          const riskValue = this.riskOrder[segment.riskLevel];
          dfs(targetId, [...path, targetId], [...segPath, segment.id], totalLength + segment.length, newRisk, totalRisk + riskValue, depth + 1);
        }
      }
      visited.delete(currentId);
    };

    dfs(fromNodeId, [fromNodeId], [], 0, 'low', 0, 0);

    if (useRiskWeight) {
      return results.sort((a, b) => a.riskScore - b.riskScore);
    }
    return results.sort((a, b) => a.totalLength - b.totalLength);
  }

  findSafestPath(fromNodeId: string): PathResult | null {
    const paths = this.findPathsToEntrance(fromNodeId, { useRiskWeight: true });
    return paths.length > 0 ? paths[0] : null;
  }

  private calculateRiskScore(length: number, maxRisk: RiskLevel): number {
    const riskWeight = this.riskOrder[maxRisk];
    return length * (1 + riskWeight * 0.5);
  }

  getDisconnectedNodes(): string[] {
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) {
      return this.nodes.filter(n => !n.isBlocked).map(n => n.id);
    }

    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList(true);
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

    return this.nodes.filter(n => !n.isBlocked && !visited.has(n.id)).map(n => n.id);
  }

  getAnalysis(): Observable<GraphAnalysis> {
    return combineLatest([this.nodes$, this.segments$, this.teamConfig$]).pipe(
      map(([nodes, segments, teamConfig]) => {
        const totalLength = segments.filter(s => !s.isBlocked).reduce((sum, s) => sum + s.length, 0);
        const overloadedAnchors = this.getAnchorLoads().filter(a => a.isOverloaded);
        const disconnectedNodes = this.getDisconnectedNodes();
        const entranceNodes = nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
        const dynamicAnchorLoads = this.getDynamicAnchorLoads();
        const highlights = this.getGraphHighlights();

        return {
          totalLength,
          nodeCount: nodes.filter(n => !n.isBlocked).length,
          segmentCount: segments.filter(s => !s.isBlocked).length,
          overloadedAnchors,
          disconnectedNodes,
          entranceNodes,
          dynamicAnchorLoads,
          highlights
        };
      })
    );
  }

  getGraphHighlights(): GraphHighlight {
    const keyAnchors = this.findKeyAnchors();
    const bottleneckSegments = this.findBottleneckSegments();
    const unreachableNodes = this.getDisconnectedNodes();
    const dangerZones = this.nodes.filter(n => n.type === 'danger' && !n.isBlocked).map(n => n.id);

    let safestPath: string[] | null = null;
    const nonDangerNodes = this.nodes.filter(n => n.type !== 'danger' && n.type !== 'entrance' && !n.isBlocked);
    if (nonDangerNodes.length > 0) {
      let bestPath: PathResult | null = null;
      for (const node of nonDangerNodes) {
        const path = this.findSafestPath(node.id);
        if (path && (!bestPath || path.riskScore < bestPath.riskScore)) {
          bestPath = path;
        }
      }
      safestPath = bestPath ? bestPath.path : null;
    }

    return {
      keyAnchors,
      bottleneckSegments,
      unreachableNodes,
      safestPath,
      dangerZones
    };
  }

  findKeyAnchors(): string[] {
    const anchors = this.nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    const keyAnchors: string[] = [];

    for (const anchor of anchors) {
      const connectedSegments = this.segments.filter(
        s => !s.isBlocked && (s.sourceId === anchor.id || s.targetId === anchor.id)
      );

      if (connectedSegments.length >= 3) {
        keyAnchors.push(anchor.id);
      }

      const connectedEntrancePaths = this.countPathsThroughNode(anchor.id);
      if (connectedEntrancePaths >= 2) {
        if (!keyAnchors.includes(anchor.id)) {
          keyAnchors.push(anchor.id);
        }
      }
    }

    return keyAnchors;
  }

  private countPathsThroughNode(nodeId: string): number {
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) return 0;

    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || node.isBlocked) return 0;

    const adjacency = this.buildAdjacencyList(true);
    let reachableCount = 0;
    const visited = new Set<string>();
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];
      for (const { targetId } of neighbors) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          if (entranceNodes.includes(targetId)) {
            reachableCount++;
          }
          queue.push(targetId);
        }
      }
    }

    return reachableCount;
  }

  findBottleneckSegments(): string[] {
    const bottlenecks: string[] = [];
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) return bottlenecks;

    const originalReachable = this.getReachableFromEntrances();

    for (const segment of this.segments.filter(s => !s.isBlocked)) {
      const tempSegments = this.segments.filter(s => s.id !== segment.id && !s.isBlocked);
      const tempReachable = this.getReachableWithSegments(tempSegments);
      const lostCount = originalReachable.filter(id => !tempReachable.includes(id)).length;

      if (lostCount > 0) {
        bottlenecks.push(segment.id);
      }
    }

    return bottlenecks;
  }

  private getReachableFromEntrances(): string[] {
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) return [];

    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList(true);
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

    return Array.from(visited);
  }

  private getReachableWithSegments(segments: RopeSegment[]): string[] {
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) return [];

    const visited = new Set<string>();
    const adjacency = new Map<string, { targetId: string; segment: RopeSegment }[]>();

    for (const segment of segments) {
      if (segment.isBlocked) continue;
      if (!adjacency.has(segment.sourceId)) {
        adjacency.set(segment.sourceId, []);
      }
      if (!adjacency.has(segment.targetId)) {
        adjacency.set(segment.targetId, []);
      }

      const direction = segment.traversalDirection || 'bidirectional';
      if (direction === 'bidirectional' || direction === 'sourceToTarget') {
        adjacency.get(segment.sourceId)!.push({ targetId: segment.targetId, segment });
      }
      if (direction === 'bidirectional' || direction === 'targetToSource') {
        adjacency.get(segment.targetId)!.push({ targetId: segment.sourceId, segment });
      }
    }

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

    return Array.from(visited);
  }

  private buildAdjacencyList(considerBlocked: boolean = true): Map<string, { targetId: string; segment: RopeSegment }[]> {
    const adjacency = new Map<string, { targetId: string; segment: RopeSegment }[]>();
    for (const segment of this.segments) {
      if (considerBlocked && segment.isBlocked) continue;

      const sourceNode = this.nodes.find(n => n.id === segment.sourceId);
      const targetNode = this.nodes.find(n => n.id === segment.targetId);
      if (considerBlocked && (sourceNode?.isBlocked || targetNode?.isBlocked)) continue;

      if (!adjacency.has(segment.sourceId)) {
        adjacency.set(segment.sourceId, []);
      }
      if (!adjacency.has(segment.targetId)) {
        adjacency.set(segment.targetId, []);
      }

      const direction: TraversalDirection = segment.traversalDirection || 'bidirectional';
      if (direction === 'bidirectional' || direction === 'sourceToTarget') {
        adjacency.get(segment.sourceId)!.push({ targetId: segment.targetId, segment });
      }
      if (direction === 'bidirectional' || direction === 'targetToSource') {
        adjacency.get(segment.targetId)!.push({ targetId: segment.sourceId, segment });
      }
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

  saveRouteVersion(name: string, description?: string): RouteVersion {
    const version: RouteVersion = {
      id: `version-${this.nextVersionId++}`,
      name,
      description,
      createdAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      segments: JSON.parse(JSON.stringify(this.segments)),
      teamConfig: JSON.parse(JSON.stringify(this.teamConfig))
    };
    const versions = [...this.routeVersions, version];
    this.routeVersions$.next(versions);
    return version;
  }

  loadRouteVersion(versionId: string): void {
    const version = this.routeVersions.find(v => v.id === versionId);
    if (version) {
      this.nodes$.next(JSON.parse(JSON.stringify(version.nodes)));
      this.segments$.next(JSON.parse(JSON.stringify(version.segments)));
      this.teamConfig$.next(JSON.parse(JSON.stringify(version.teamConfig)));
    }
  }

  deleteRouteVersion(versionId: string): void {
    const versions = this.routeVersions.filter(v => v.id !== versionId);
    this.routeVersions$.next(versions);
  }

  compareRouteVersions(versionAId: string, versionBId: string): RouteComparison | null {
    const versionA = this.routeVersions.find(v => v.id === versionAId);
    const versionB = this.routeVersions.find(v => v.id === versionBId);
    if (!versionA || !versionB) return null;

    const nodeIdsA = new Set(versionA.nodes.map(n => n.id));
    const nodeIdsB = new Set(versionB.nodes.map(n => n.id));
    const segIdsA = new Set(versionA.segments.map(s => s.id));
    const segIdsB = new Set(versionB.segments.map(s => s.id));

    const addedNodes = Array.from(nodeIdsB).filter(id => !nodeIdsA.has(id));
    const removedNodes = Array.from(nodeIdsA).filter(id => !nodeIdsB.has(id));
    const addedSegments = Array.from(segIdsB).filter(id => !segIdsA.has(id));
    const removedSegments = Array.from(segIdsA).filter(id => !segIdsB.has(id));

    const changedSegments: string[] = [];
    for (const segId of segIdsA) {
      if (segIdsB.has(segId)) {
        const segA = versionA.segments.find(s => s.id === segId);
        const segB = versionB.segments.find(s => s.id === segId);
        if (segA && segB) {
          if (segA.length !== segB.length || segA.riskLevel !== segB.riskLevel ||
              segA.maxLoad !== segB.maxLoad || segA.sourceId !== segB.sourceId ||
              segA.targetId !== segB.targetId) {
            changedSegments.push(segId);
          }
        }
      }
    }

    const totalLengthA = versionA.segments.reduce((sum, s) => sum + s.length, 0);
    const totalLengthB = versionB.segments.reduce((sum, s) => sum + s.length, 0);

    return {
      versionA,
      versionB,
      addedNodes,
      removedNodes,
      addedSegments,
      removedSegments,
      changedSegments,
      totalLengthDiff: totalLengthB - totalLengthA,
      riskLevelDiff: this.compareRiskLevels(versionA.segments, versionB.segments)
    };
  }

  private compareRiskLevels(segsA: RopeSegment[], segsB: RopeSegment[]): string {
    const avgRiskA = segsA.length > 0
      ? segsA.reduce((sum, s) => sum + this.riskOrder[s.riskLevel], 0) / segsA.length
      : 0;
    const avgRiskB = segsB.length > 0
      ? segsB.reduce((sum, s) => sum + this.riskOrder[s.riskLevel], 0) / segsB.length
      : 0;

    const diff = avgRiskB - avgRiskA;
    if (diff > 0.5) return '风险显著增加';
    if (diff > 0) return '风险略有增加';
    if (diff < -0.5) return '风险显著降低';
    if (diff < 0) return '风险略有降低';
    return '风险相当';
  }

  enterSimulationMode(): void {
    this.simulationMode$.next(true);
    this.simulatedRemovedNodes$.next([]);
    this.simulatedRemovedSegments$.next([]);
  }

  exitSimulationMode(): void {
    this.simulationMode$.next(false);
    this.simulatedRemovedNodes$.next([]);
    this.simulatedRemovedSegments$.next([]);
  }

  simulateRemoveNode(nodeId: string): void {
    const removed = this.simulatedRemovedNodes;
    if (!removed.includes(nodeId)) {
      this.simulatedRemovedNodes$.next([...removed, nodeId]);
    }
  }

  simulateRestoreNode(nodeId: string): void {
    this.simulatedRemovedNodes$.next(
      this.simulatedRemovedNodes.filter(id => id !== nodeId)
    );
  }

  simulateRemoveSegment(segmentId: string): void {
    const removed = this.simulatedRemovedSegments;
    if (!removed.includes(segmentId)) {
      this.simulatedRemovedSegments$.next([...removed, segmentId]);
    }
  }

  simulateRestoreSegment(segmentId: string): void {
    this.simulatedRemovedSegments$.next(
      this.simulatedRemovedSegments.filter(id => id !== segmentId)
    );
  }

  runSimulation(): SimulationResult {
    const removedNodeIds = this.simulatedRemovedNodes;
    const removedSegmentIds = this.simulatedRemovedSegments;

    const originalReachable = this.getDisconnectedNodes();
    const allNodes = this.nodes.filter(n => !n.isBlocked).map(n => n.id);
    const previouslyReachable = allNodes.filter(id => !originalReachable.includes(id));

    const activeNodes = this.nodes.filter(
      n => !n.isBlocked && !removedNodeIds.includes(n.id)
    );
    const activeSegments = this.segments.filter(
      s => !s.isBlocked && !removedSegmentIds.includes(s.id) &&
           !removedNodeIds.includes(s.sourceId) && !removedNodeIds.includes(s.targetId)
    );

    const entranceNodes = activeNodes.filter(n => n.type === 'entrance').map(n => n.id);
    const nowReachable: string[] = [];

    if (entranceNodes.length > 0) {
      const visited = new Set<string>();
      const adjacency = new Map<string, string[]>();

      for (const segment of activeSegments) {
        if (!adjacency.has(segment.sourceId)) {
          adjacency.set(segment.sourceId, []);
        }
        if (!adjacency.has(segment.targetId)) {
          adjacency.set(segment.targetId, []);
        }
        const direction = segment.traversalDirection || 'bidirectional';
        if (direction === 'bidirectional' || direction === 'sourceToTarget') {
          adjacency.get(segment.sourceId)!.push(segment.targetId);
        }
        if (direction === 'bidirectional' || direction === 'targetToSource') {
          adjacency.get(segment.targetId)!.push(segment.sourceId);
        }
      }

      const queue = [...entranceNodes];
      entranceNodes.forEach(id => visited.add(id));

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adjacency.get(current) || [];
        for (const targetId of neighbors) {
          if (!visited.has(targetId)) {
            visited.add(targetId);
            queue.push(targetId);
          }
        }
      }

      for (const node of activeNodes) {
        if (visited.has(node.id)) {
          nowReachable.push(node.id);
        }
      }
    }

    const nowUnreachable = previouslyReachable.filter(id => !nowReachable.includes(id));
    const stillReachable = previouslyReachable.filter(id => nowReachable.includes(id));

    const newOverloadedAnchors: string[] = [];
    const anchorLoads = this.getAnchorLoads();
    for (const anchor of anchorLoads) {
      if (removedNodeIds.includes(anchor.nodeId)) continue;
      const connectedActiveSegs = activeSegments.filter(
        s => s.sourceId === anchor.nodeId || s.targetId === anchor.nodeId
      );
      const load = connectedActiveSegs.reduce((sum, s) => sum + s.maxLoad, 0);
      if (anchor.maxLoad > 0 && load > anchor.maxLoad) {
        if (!anchor.isOverloaded) {
          newOverloadedAnchors.push(anchor.nodeId);
        }
      }
    }

    const affectedPaths: { nodeId: string; originalPathCount: number; newPathCount: number }[] = [];
    for (const nodeId of stillReachable) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node || node.type === 'entrance') continue;

      const origPaths = this.findPathsToEntrance(nodeId);
      let newPathCount = 0;

      const tempNodes = this.nodes.filter(n => !removedNodeIds.includes(n.id));
      const tempSegments = this.segments.filter(s => !removedSegmentIds.includes(s.id));
      const origNodes = this.nodes;
      const origSegments = this.segments;

      this.nodes$.next(tempNodes);
      this.segments$.next(tempSegments);
      const newPaths = this.findPathsToEntrance(nodeId);
      newPathCount = newPaths.length;
      this.nodes$.next(origNodes);
      this.segments$.next(origSegments);

      if (origPaths.length !== newPathCount) {
        affectedPaths.push({
          nodeId,
          originalPathCount: origPaths.length,
          newPathCount
        });
      }
    }

    const riskIncrease = this.calculateRiskIncrease(activeSegments);

    return {
      removedNodeIds,
      removedSegmentIds,
      previouslyReachable,
      nowUnreachable,
      stillReachable,
      newOverloadedAnchors,
      riskIncrease,
      affectedPaths
    };
  }

  private calculateRiskIncrease(activeSegments: RopeSegment[]): number {
    const allSegs = this.segments.filter(s => !s.isBlocked);
    const origAvgRisk = allSegs.length > 0
      ? allSegs.reduce((sum, s) => sum + this.riskOrder[s.riskLevel], 0) / allSegs.length
      : 0;
    const newAvgRisk = activeSegments.length > 0
      ? activeSegments.reduce((sum, s) => sum + this.riskOrder[s.riskLevel], 0) / activeSegments.length
      : 0;
    return newAvgRisk - origAvgRisk;
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
      { id: 'platform-3', name: '东侧平台', type: 'platform', x: 750, y: 380, description: '东侧分支平台' },
      { id: 'anchor-4', name: '主通道锚点', type: 'anchor', x: 400, y: 420, description: '主通道关键锚点', maxLoad: 450 },
      { id: 'entrance-2', name: '紧急出口', type: 'entrance', x: 150, y: 350, description: '备用紧急出口' }
    ];

    const sampleSegments: RopeSegment[] = [
      { id: 'seg-1', sourceId: 'entrance-1', targetId: 'anchor-1', length: 15, slope: 45, maxLoad: 200, riskLevel: 'low', description: '入口下降绳' },
      { id: 'seg-2', sourceId: 'anchor-1', targetId: 'platform-1', length: 20, slope: 30, maxLoad: 200, riskLevel: 'low', description: '斜向下降' },
      { id: 'seg-3', sourceId: 'platform-1', targetId: 'anchor-2', length: 30, slope: 0, maxLoad: 150, riskLevel: 'medium', description: '水平横移' },
      { id: 'seg-4', sourceId: 'anchor-2', targetId: 'shaft-1', length: 25, slope: 90, maxLoad: 300, riskLevel: 'high', description: '竖井主绳' },
      { id: 'seg-5', sourceId: 'shaft-1', targetId: 'platform-2', length: 10, slope: 10, maxLoad: 200, riskLevel: 'low', description: '竖井底部' },
      { id: 'seg-6', sourceId: 'platform-2', targetId: 'anchor-3', length: 18, slope: 20, maxLoad: 180, riskLevel: 'medium', description: '分支路线' },
      { id: 'seg-7', sourceId: 'anchor-3', targetId: 'platform-3', length: 22, slope: 15, maxLoad: 200, riskLevel: 'low', description: '东侧分支' },
      { id: 'seg-8', sourceId: 'platform-1', targetId: 'danger-1', length: 12, slope: 5, maxLoad: 100, riskLevel: 'high', description: '通往落石区' },
      { id: 'seg-9', sourceId: 'anchor-1', targetId: 'anchor-4', length: 35, slope: 60, maxLoad: 250, riskLevel: 'medium', description: '主通道绳段', traversalDirection: 'bidirectional' },
      { id: 'seg-10', sourceId: 'anchor-4', targetId: 'platform-2', length: 20, slope: 35, maxLoad: 220, riskLevel: 'low', description: '主通道下段' },
      { id: 'seg-11', sourceId: 'platform-1', targetId: 'entrance-2', length: 25, slope: -20, maxLoad: 180, riskLevel: 'medium', description: '通往紧急出口' }
    ];

    this.nodes$.next(sampleNodes);
    this.segments$.next(sampleSegments);
    this.nextNodeId = 12;
    this.nextSegmentId = 12;

    this.teamConfig$.next({
      members: [
        { id: 'member-1', name: '队长-张伟', weight: 75, equipmentWeight: 15 },
        { id: 'member-2', name: '队员-李娜', weight: 60, equipmentWeight: 12 },
        { id: 'member-3', name: '队员-王强', weight: 80, equipmentWeight: 18 },
        { id: 'member-4', name: '队员-赵敏', weight: 55, equipmentWeight: 10 }
      ],
      passingOrder: ['member-1', 'member-2', 'member-3', 'member-4'],
      safetyFactor: 1.5
    });
    this.nextMemberId = 5;
  }
}
