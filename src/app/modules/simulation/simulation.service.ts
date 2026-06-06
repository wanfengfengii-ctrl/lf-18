import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CaveNode,
  RopeSegment,
  RiskLevel,
  AnchorLoadInfo,
  PathResult,
  SimulationResult,
  TraversalDirection
} from '../../shared/models';
import { GraphStateService } from '../../core/state/graph-state.service';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private simulationMode$ = new BehaviorSubject<boolean>(false);
  private simulatedRemovedNodes$ = new BehaviorSubject<string[]>([]);
  private simulatedRemovedSegments$ = new BehaviorSubject<string[]>([]);

  constructor(private graphState: GraphStateService) {}

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

  getSimulatedRemovedNodes(): Observable<string[]> {
    return this.simulatedRemovedNodes$.asObservable();
  }

  getSimulatedRemovedSegments(): Observable<string[]> {
    return this.simulatedRemovedSegments$.asObservable();
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
    const allNodes = this.graphState.nodes.filter(n => !n.isBlocked).map(n => n.id);
    const previouslyReachable = allNodes.filter(id => !originalReachable.includes(id));

    const activeNodes = this.graphState.nodes.filter(
      n => !n.isBlocked && !removedNodeIds.includes(n.id)
    );
    const activeSegments = this.graphState.segments.filter(
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
      const node = this.graphState.nodes.find(n => n.id === nodeId);
      if (!node || node.type === 'entrance') continue;

      const origPaths = this.findPathsToEntrance(nodeId);
      let newPathCount = 0;

      const tempNodes = this.graphState.nodes.filter(n => !removedNodeIds.includes(n.id));
      const tempSegments = this.graphState.segments.filter(s => !removedSegmentIds.includes(s.id));
      const newPaths = this.findPathsToEntranceWithData(nodeId, tempNodes, tempSegments);
      newPathCount = newPaths.length;

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
    const allSegs = this.graphState.segments.filter(s => !s.isBlocked);
    const origAvgRisk = allSegs.length > 0
      ? allSegs.reduce((sum, s) => sum + this.riskOrder[s.riskLevel], 0) / allSegs.length
      : 0;
    const newAvgRisk = activeSegments.length > 0
      ? activeSegments.reduce((sum, s) => sum + this.riskOrder[s.riskLevel], 0) / activeSegments.length
      : 0;
    return newAvgRisk - origAvgRisk;
  }

  private getDisconnectedNodes(): string[] {
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

  private getAnchorLoads(): AnchorLoadInfo[] {
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

  private findPathsToEntrance(fromNodeId: string, options?: { useRiskWeight?: boolean; considerBlocked?: boolean }): PathResult[] {
    return this.findPathsToEntranceWithData(
      fromNodeId,
      this.graphState.nodes,
      this.graphState.segments,
      options
    );
  }

  private findPathsToEntranceWithData(
    fromNodeId: string,
    nodes: CaveNode[],
    segments: RopeSegment[],
    options?: { useRiskWeight?: boolean; considerBlocked?: boolean }
  ): PathResult[] {
    const useRiskWeight = options?.useRiskWeight ?? false;
    const considerBlocked = options?.considerBlocked ?? true;

    const entranceNodes = nodes.filter(n => n.type === 'entrance' && (!considerBlocked || !n.isBlocked)).map(n => n.id);
    if (entranceNodes.length === 0) return [];
    if (entranceNodes.includes(fromNodeId)) {
      return [{ path: [fromNodeId], totalLength: 0, maxRisk: 'low', riskScore: 0, avgRisk: 0, segments: [] }];
    }

    const results: PathResult[] = [];
    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyListWithData(nodes, segments, considerBlocked);

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

  private buildAdjacencyList(considerBlocked: boolean = true): Map<string, { targetId: string; segment: RopeSegment }[]> {
    return this.buildAdjacencyListWithData(
      this.graphState.nodes,
      this.graphState.segments,
      considerBlocked
    );
  }

  private buildAdjacencyListWithData(
    nodes: CaveNode[],
    segments: RopeSegment[],
    considerBlocked: boolean = true
  ): Map<string, { targetId: string; segment: RopeSegment }[]> {
    const adjacency = new Map<string, { targetId: string; segment: RopeSegment }[]>();
    const simMode = this.isSimulationMode;
    const simRemovedNodes = this.simulatedRemovedNodes;
    const simRemovedSegments = this.simulatedRemovedSegments;

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
