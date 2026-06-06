import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CaveNode,
  RopeSegment,
  RiskLevel,
  AnchorLoadInfo,
  PathResult,
  TeamConfig,
  TeamMember,
  AnchorDynamicLoad,
  TraversalDirection
} from '../../shared/models';
import { GraphStateService } from '../../core/state/graph-state.service';

@Injectable({
  providedIn: 'root'
})
export class PathAnalysisService {
  private teamConfig$ = new BehaviorSubject<TeamConfig>({
    members: [],
    passingOrder: [],
    safetyFactor: 1.5
  });

  private simulationMode$ = new BehaviorSubject<boolean>(false);
  private simulatedRemovedNodes$ = new BehaviorSubject<string[]>([]);
  private simulatedRemovedSegments$ = new BehaviorSubject<string[]>([]);

  constructor(private graphState: GraphStateService) {}

  get teamConfig(): TeamConfig {
    return this.teamConfig$.value;
  }

  getTeamConfig(): Observable<TeamConfig> {
    return this.teamConfig$.asObservable();
  }

  setTeamConfig(config: TeamConfig): void {
    this.teamConfig$.next({ ...config });
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

  getSimulationMode(): Observable<boolean> {
    return this.simulationMode$.asObservable();
  }

  setSimulationMode(mode: boolean): void {
    this.simulationMode$.next(mode);
  }

  setSimulatedRemovedNodes(nodes: string[]): void {
    this.simulatedRemovedNodes$.next([...nodes]);
  }

  setSimulatedRemovedSegments(segments: string[]): void {
    this.simulatedRemovedSegments$.next([...segments]);
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

  findPathsToEntrance(fromNodeId: string, options?: { useRiskWeight?: boolean; considerBlocked?: boolean }): PathResult[] {
    const useRiskWeight = options?.useRiskWeight ?? false;
    const considerBlocked = options?.considerBlocked ?? true;

    const nodes = this.graphState.nodes;
    const entranceNodes = nodes.filter(n => n.type === 'entrance' && (!considerBlocked || !n.isBlocked)).map(n => n.id);
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

  private findPathsBetween(sourceId: string, targetId: string): PathResult[] {
    const results: PathResult[] = [];
    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList(true);

    const dfs = (currentId: string, path: string[], segPath: string[], totalLength: number, maxRisk: RiskLevel, totalRisk: number, depth: number) => {
      if (currentId === targetId) {
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
      for (const { targetId: nextId, segment } of neighbors) {
        if (!visited.has(nextId)) {
          const newRisk = this.maxRiskLevel(maxRisk, segment.riskLevel);
          const riskValue = this.riskOrder[segment.riskLevel];
          dfs(nextId, [...path, nextId], [...segPath, segment.id], totalLength + segment.length, newRisk, totalRisk + riskValue, depth + 1);
        }
      }
      visited.delete(currentId);
    };

    dfs(sourceId, [sourceId], [], 0, 'low', 0, 0);
    return results.sort((a, b) => a.totalLength - b.totalLength);
  }

  getDisconnectedNodes(): string[] {
    const simMode = this.isSimulationMode;
    const simRemovedNodes = this.simulatedRemovedNodes;
    const nodes = this.graphState.nodes;

    const entranceNodes = nodes.filter(
      n => n.type === 'entrance' && !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id))
    ).map(n => n.id);

    if (entranceNodes.length === 0) {
      return nodes.filter(
        n => !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id))
      ).map(n => n.id);
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

    return nodes.filter(
      n => !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id)) && !visited.has(n.id)
    ).map(n => n.id);
  }

  private getReachableFromEntrances(): string[] {
    const nodes = this.graphState.nodes;
    const entranceNodes = nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
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

  private countPathsThroughNode(nodeId: string): number {
    const nodes = this.graphState.nodes;
    const entranceNodes = nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) return 0;

    const node = nodes.find(n => n.id === nodeId);
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

  findKeyAnchors(): string[] {
    const nodes = this.graphState.nodes;
    const segments = this.graphState.segments;
    const anchors = nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    const keyAnchors: string[] = [];

    for (const anchor of anchors) {
      const connectedSegments = segments.filter(
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

  findBottleneckSegments(): string[] {
    const bottlenecks: string[] = [];
    const nodes = this.graphState.nodes;
    const segments = this.graphState.segments;
    const entranceNodes = nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
    if (entranceNodes.length === 0) return bottlenecks;

    const originalReachable = this.getReachableFromEntrances();

    for (const segment of segments.filter(s => !s.isBlocked)) {
      const tempSegments = segments.filter(s => s.id !== segment.id && !s.isBlocked);
      const tempReachable = this.getReachableWithSegments(tempSegments);
      const lostCount = originalReachable.filter(id => !tempReachable.includes(id)).length;

      if (lostCount > 0) {
        bottlenecks.push(segment.id);
      }
    }

    return bottlenecks;
  }

  private getReachableWithSegments(segments: RopeSegment[]): string[] {
    const nodes = this.graphState.nodes;
    const entranceNodes = nodes.filter(n => n.type === 'entrance' && !n.isBlocked).map(n => n.id);
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
    const simMode = this.isSimulationMode;
    const simRemovedNodes = this.simulatedRemovedNodes;
    const simRemovedSegments = this.simulatedRemovedSegments;
    const nodes = this.graphState.nodes;
    const segments = this.graphState.segments;

    for (const segment of segments) {
      if (considerBlocked && segment.isBlocked) continue;
      if (simMode && simRemovedSegments.includes(segment.id)) continue;

      const sourceNode = nodes.find(n => n.id === segment.sourceId);
      const targetNode = nodes.find(n => n.id === segment.targetId);
      if (considerBlocked && (sourceNode?.isBlocked || targetNode?.isBlocked)) continue;
      if (simMode && (simRemovedNodes.includes(segment.sourceId) || simRemovedNodes.includes(segment.targetId))) continue;

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

  getAnchorLoads(): AnchorLoadInfo[] {
    const nodes = this.graphState.nodes;
    const segments = this.graphState.segments;
    const anchors = nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    return anchors.map(anchor => {
      const connectedSegments = segments.filter(
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
    const nodes = this.graphState.nodes;
    const segments = this.graphState.segments;

    const anchors = nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    return anchors.map(anchor => {
      const connectedSegments = segments.filter(
        s => !s.isBlocked && (s.sourceId === anchor.id || s.targetId === anchor.id)
      );
      const staticLoad = connectedSegments.reduce((sum, s) => sum + s.maxLoad, 0);

      const peakWeight = this.calculatePeakWeightAtAnchor(anchor.id);
      const dynamicLoad = staticLoad + peakWeight * team.safetyFactor;

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

  private calculatePeakWeightAtAnchor(anchorId: string): number {
    const team = this.teamConfig;
    const segments = this.graphState.segments;
    const connectedSegments = segments.filter(
      s => !s.isBlocked && (s.sourceId === anchorId || s.targetId === anchorId)
    );

    if (connectedSegments.length === 0 || team.members.length === 0) return 0;

    const concurrentPeople = Math.min(connectedSegments.length + 1, team.members.length);

    const orderedMembers = team.passingOrder
      .map(id => team.members.find(m => m.id === id))
      .filter((m): m is TeamMember => m !== undefined);

    if (orderedMembers.length === 0) {
      const sortedMembers = [...team.members].sort(
        (a, b) => (b.weight + b.equipmentWeight) - (a.weight + a.equipmentWeight)
      );
      let sum = 0;
      for (let i = 0; i < Math.min(concurrentPeople, sortedMembers.length); i++) {
        sum += sortedMembers[i].weight + sortedMembers[i].equipmentWeight;
      }
      return sum;
    }

    if (concurrentPeople >= orderedMembers.length) {
      return orderedMembers.reduce((sum, m) => sum + m.weight + m.equipmentWeight, 0);
    }

    let maxSum = 0;
    const circular = [...orderedMembers, ...orderedMembers];
    for (let i = 0; i < orderedMembers.length; i++) {
      let windowSum = 0;
      for (let j = 0; j < concurrentPeople; j++) {
        windowSum += circular[i + j].weight + circular[i + j].equipmentWeight;
      }
      if (windowSum > maxSum) {
        maxSum = windowSum;
      }
    }

    return maxSum;
  }

  private calculatePeakLoadMembers(anchorId: string): string[] {
    const team = this.teamConfig;
    const segments = this.graphState.segments;
    const connectedSegments = segments.filter(
      s => !s.isBlocked && (s.sourceId === anchorId || s.targetId === anchorId)
    );

    if (connectedSegments.length === 0 || team.members.length === 0) return [];

    const concurrentPeople = Math.min(connectedSegments.length + 1, team.members.length);

    const orderedMembers = team.passingOrder
      .map(id => team.members.find(m => m.id === id))
      .filter((m): m is TeamMember => m !== undefined);

    if (orderedMembers.length === 0) {
      const sortedMembers = [...team.members].sort(
        (a, b) => (b.weight + b.equipmentWeight) - (a.weight + a.equipmentWeight)
      );
      return sortedMembers.slice(0, concurrentPeople).map(m => m.name);
    }

    if (concurrentPeople >= orderedMembers.length) {
      return orderedMembers.map(m => m.name);
    }

    let maxSum = 0;
    let maxStartIdx = 0;
    const circular = [...orderedMembers, ...orderedMembers];
    for (let i = 0; i < orderedMembers.length; i++) {
      let windowSum = 0;
      for (let j = 0; j < concurrentPeople; j++) {
        windowSum += circular[i + j].weight + circular[i + j].equipmentWeight;
      }
      if (windowSum > maxSum) {
        maxSum = windowSum;
        maxStartIdx = i;
      }
    }

    const peakMembers: string[] = [];
    for (let j = 0; j < concurrentPeople; j++) {
      peakMembers.push(circular[maxStartIdx + j].name);
    }
    return peakMembers;
  }

  checkSegmentOverload(
    sourceId: string,
    targetId: string,
    segmentMaxLoad: number,
    excludeSegmentId?: string
  ): { overloadedAnchors: { nodeId: string; nodeName: string; totalLoad: number; maxLoad: number }[] } {
    const overloadedAnchors: { nodeId: string; nodeName: string; totalLoad: number; maxLoad: number }[] = [];
    const nodeIdsToCheck = [sourceId, targetId];
    const nodes = this.graphState.nodes;
    const segments = this.graphState.segments;

    for (const nodeId of nodeIdsToCheck) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'anchor' || !node.maxLoad) continue;

      const connectedSegments = segments.filter(
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

  private riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  private maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
    return this.riskOrder[a] >= this.riskOrder[b] ? a : b;
  }

  private calculateRiskScore(length: number, maxRisk: RiskLevel): number {
    const riskWeight = this.riskOrder[maxRisk];
    return length * (1 + riskWeight * 0.5);
  }
}
