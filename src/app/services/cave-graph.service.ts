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
  TraversalDirection,
  SupplyItem,
  SupplyType,
  SupplyAdequacyLevel,
  SupplyAdequacyItem,
  NodeSupplyAssessment,
  SupplyPlacementRecommendation,
  EmergencySupplyRoute,
  SupplyAnalysis,
  SupplyConsumptionRate,
  SUPPLY_TYPE_MAP,
  SUPPLY_PRIORITY_MAP,
  SUPPLY_ADEQUACY_MAP,
  DEFAULT_CONSUMPTION_RATES
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
  private consumptionRates$ = new BehaviorSubject<SupplyConsumptionRate[]>(
    JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES))
  );
  private estimatedDurationHours$ = new BehaviorSubject<number>(8);

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

  getConsumptionRates(): Observable<SupplyConsumptionRate[]> {
    return this.consumptionRates$.asObservable();
  }

  get consumptionRates(): SupplyConsumptionRate[] {
    return this.consumptionRates$.value;
  }

  getEstimatedDurationHours(): Observable<number> {
    return this.estimatedDurationHours$.asObservable();
  }

  get estimatedDurationHours(): number {
    return this.estimatedDurationHours$.value;
  }

  setConsumptionRates(rates: SupplyConsumptionRate[]): void {
    this.consumptionRates$.next([...rates]);
  }

  setEstimatedDurationHours(hours: number): void {
    this.estimatedDurationHours$.next(Math.max(1, hours));
  }

  getSupplyNodes(): CaveNode[] {
    return this.nodes.filter(n => n.type === 'supply' && !n.isBlocked);
  }

  getNodeSupplies(nodeId: string): SupplyItem[] {
    const node = this.nodes.find(n => n.id === nodeId);
    return node?.supplies ? [...node.supplies] : [];
  }

  updateNodeSupplies(nodeId: string, supplies: SupplyItem[]): boolean {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    this.updateNode(nodeId, { supplies: [...supplies] });
    return true;
  }

  addSupplyItem(nodeId: string, item: SupplyItem): boolean {
    const supplies = this.getNodeSupplies(nodeId);
    const existingIndex = supplies.findIndex(s => s.type === item.type);
    if (existingIndex >= 0) {
      supplies[existingIndex] = { ...item };
    } else {
      supplies.push({ ...item });
    }
    return this.updateNodeSupplies(nodeId, supplies);
  }

  removeSupplyItem(nodeId: string, supplyType: SupplyType): boolean {
    const supplies = this.getNodeSupplies(nodeId);
    const filtered = supplies.filter(s => s.type !== supplyType);
    return this.updateNodeSupplies(nodeId, filtered);
  }

  getTotalSuppliesWeight(nodeId: string): number {
    const supplies = this.getNodeSupplies(nodeId);
    return supplies.reduce((sum, s) => sum + s.quantity * s.unitWeight, 0);
  }

  getSupplyNodesWithSupplies(): CaveNode[] {
    return this.nodes.filter(n => 
      n.type === 'supply' && !n.isBlocked && n.supplies && n.supplies.length > 0
    );
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
      isBlocked: node.isBlocked || false,
      supplies: node.supplies ? [...node.supplies] : undefined
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

    const anchors = this.nodes.filter(n => n.type === 'anchor' && !n.isBlocked);
    return anchors.map(anchor => {
      const connectedSegments = this.segments.filter(
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
    const connectedSegments = this.segments.filter(
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
    const connectedSegments = this.segments.filter(
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
    const simMode = this.isSimulationMode;
    const simRemovedNodes = this.simulatedRemovedNodes;

    const entranceNodes = this.nodes.filter(
      n => n.type === 'entrance' && !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id))
    ).map(n => n.id);

    if (entranceNodes.length === 0) {
      return this.nodes.filter(
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

    return this.nodes.filter(
      n => !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id)) && !visited.has(n.id)
    ).map(n => n.id);
  }

  private calculateSupplyRequirements(distance: number, teamSize: number, riskLevel: RiskLevel): Record<SupplyType, number> {
    const rates = this.consumptionRates;
    const hours = this.estimatedDurationHours;
    const riskMultiplier = this.riskOrder[riskLevel] * 0.2 + 1;
    const distanceFactor = Math.max(1, distance / 100);

    const requirements: Record<SupplyType, number> = {
      oxygen: 0,
      medicine: 0,
      lighting: 0,
      battery: 0,
      food: 0
    };

    for (const rate of rates) {
      const baseNeed = rate.perPersonPerHour * teamSize * hours * riskMultiplier;
      const distanceNeed = rate.perPersonPerHour * teamSize * distanceFactor * 2;
      requirements[rate.type] = Math.ceil(baseNeed + distanceNeed);
    }

    return requirements;
  }

  private getAdequacyLevel(adequacy: number): SupplyAdequacyLevel {
    if (adequacy >= 1.5) return 'sufficient';
    if (adequacy >= 1.0) return 'warning';
    if (adequacy >= 0.5) return 'deficit';
    return 'critical';
  }

  assessNodeSupplyAdequacy(nodeId: string): NodeSupplyAssessment | null {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || node.isBlocked) return null;

    const teamSize = this.teamConfig.members.length;
    const paths = this.findPathsToEntrance(nodeId);
    const avgDistance = paths.length > 0 
      ? paths.reduce((sum, p) => sum + p.totalLength, 0) / paths.length 
      : 100;
    const maxRisk = paths.length > 0 
      ? paths[0].maxRisk 
      : 'medium';

    const requirements = this.calculateSupplyRequirements(avgDistance, teamSize, maxRisk);
    const supplies = node.supplies || [];
    const rates = this.consumptionRates;

    const adequacyItems: SupplyAdequacyItem[] = rates.map(rate => {
      const supply = supplies.find(s => s.type === rate.type);
      const available = supply?.quantity || 0;
      const required = requirements[rate.type];
      const adequacy = required > 0 ? available / required : 999;
      const daysRemaining = rate.perPersonPerHour > 0 && teamSize > 0
        ? available / (rate.perPersonPerHour * teamSize * 24)
        : 999;

      return {
        type: rate.type,
        available,
        required,
        adequacy,
        level: this.getAdequacyLevel(adequacy),
        daysRemaining
      };
    });

    const overallLevel = this.getOverallAdequacyLevel(adequacyItems);
    const totalWeight = supplies.reduce((sum, s) => sum + s.quantity * s.unitWeight, 0);

    const nearestSupply = this.findNearestSupplyPoint(nodeId);
    const reachableSupplies = this.findReachableSupplyPoints(nodeId);

    return {
      nodeId,
      nodeName: node.name,
      totalSuppliesWeight: totalWeight,
      adequacyItems,
      overallLevel,
      nearestSupplyPoint: nearestSupply?.nodeId,
      distanceToSupply: nearestSupply?.distance || 0,
      reachableSupplyPoints: reachableSupplies.map(s => s.nodeId)
    };
  }

  private getOverallAdequacyLevel(items: SupplyAdequacyItem[]): SupplyAdequacyLevel {
    if (items.length === 0) return 'sufficient';
    const priorityOrder: SupplyAdequacyLevel[] = ['critical', 'deficit', 'warning', 'sufficient'];
    for (const level of priorityOrder) {
      const count = items.filter(i => i.level === level).length;
      if (count >= 2 || (count >= 1 && level === 'critical')) {
        return level;
      }
    }
    const hasWarning = items.some(i => i.level === 'warning');
    return hasWarning ? 'warning' : 'sufficient';
  }

  findNearestSupplyPoint(fromNodeId: string): { nodeId: string; distance: number; path: PathResult } | null {
    const supplyNodes = this.getSupplyNodesWithSupplies();
    if (supplyNodes.length === 0) return null;
    if (supplyNodes.some(n => n.id === fromNodeId)) {
      return { nodeId: fromNodeId, distance: 0, path: { path: [fromNodeId], totalLength: 0, maxRisk: 'low', riskScore: 0, avgRisk: 0, segments: [] } };
    }

    let best: { nodeId: string; distance: number; path: PathResult } | null = null;

    for (const supplyNode of supplyNodes) {
      const paths = this.findPathsBetween(fromNodeId, supplyNode.id);
      if (paths.length > 0) {
        const shortest = paths[0];
        if (!best || shortest.totalLength < best.distance) {
          best = { nodeId: supplyNode.id, distance: shortest.totalLength, path: shortest };
        }
      }
    }

    return best;
  }

  findReachableSupplyPoints(fromNodeId: string): { nodeId: string; distance: number; path: PathResult }[] {
    const supplyNodes = this.getSupplyNodesWithSupplies();
    const results: { nodeId: string; distance: number; path: PathResult }[] = [];

    if (supplyNodes.some(n => n.id === fromNodeId)) {
      results.push({ 
        nodeId: fromNodeId, 
        distance: 0, 
        path: { path: [fromNodeId], totalLength: 0, maxRisk: 'low', riskScore: 0, avgRisk: 0, segments: [] } 
      });
    }

    for (const supplyNode of supplyNodes) {
      if (supplyNode.id === fromNodeId) continue;
      const paths = this.findPathsBetween(fromNodeId, supplyNode.id);
      if (paths.length > 0) {
        results.push({ nodeId: supplyNode.id, distance: paths[0].totalLength, path: paths[0] });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
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

  recommendSupplyPlacements(maxRecommendations: number = 3): SupplyPlacementRecommendation[] {
    const allNodes = this.nodes.filter(n => !n.isBlocked && n.type !== 'danger');
    const existingSupplyNodeIds = new Set(this.getSupplyNodesWithSupplies().map(n => n.id));
    const teamSize = this.teamConfig.members.length;

    const candidates: SupplyPlacementRecommendation[] = [];

    for (const node of allNodes) {
      if (existingSupplyNodeIds.has(node.id)) continue;

      const paths = this.findPathsToEntrance(node.id);
      if (paths.length === 0) continue;

      const distanceToEntrance = paths[0].totalLength;
      const riskLevel = paths[0].maxRisk;
      const connectedSegments = this.segments.filter(
        s => !s.isBlocked && (s.sourceId === node.id || s.targetId === node.id)
      );

      let score = 0;
      let reasons: string[] = [];

      if (connectedSegments.length >= 3) {
        score += 30;
        reasons.push('位于路线交汇点');
      }

      if (distanceToEntrance > 50 && distanceToEntrance < 200) {
        score += 25;
        reasons.push('距离适中，便于前出补给');
      }

      if (riskLevel === 'high' || riskLevel === 'critical') {
        score += 20;
        reasons.push('高风险区域附近，应急需求大');
      }

      if (node.type === 'platform') {
        score += 15;
        reasons.push('平台节点，便于停留补给');
      }

      const nearbyAssessment = this.assessNodeSupplyAdequacy(node.id);
      if (nearbyAssessment && (nearbyAssessment.overallLevel === 'deficit' || nearbyAssessment.overallLevel === 'critical')) {
        score += 20;
        reasons.push('周边物资不足');
      }

      const nearestSupply = this.findNearestSupplyPoint(node.id);
      if (nearestSupply && nearestSupply.distance > 80) {
        score += 15;
        reasons.push('距最近补给点较远');
      }

      if (score > 20) {
        const requiredSupplies = this.calculateSupplyRequirements(distanceToEntrance, teamSize, riskLevel);
        const recommendedSupplies = Object.entries(requiredSupplies).map(([type, qty]) => ({
          type: type as SupplyType,
          quantity: Math.ceil(qty * 1.5)
        }));

        const coverageNodes = this.findNodesWithinDistance(node.id, 60);

        candidates.push({
          nodeId: node.id,
          nodeName: node.name,
          score,
          reason: reasons.join('；'),
          recommendedSupplies,
          coverageNodes: coverageNodes
        });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRecommendations);
  }

  private findNodesWithinDistance(fromNodeId: string, maxDistance: number): string[] {
    const result: string[] = [];
    const allNodes = this.nodes.filter(n => !n.isBlocked && n.type !== 'danger');

    for (const node of allNodes) {
      if (node.id === fromNodeId) continue;
      const paths = this.findPathsBetween(fromNodeId, node.id);
      if (paths.length > 0 && paths[0].totalLength <= maxDistance) {
        result.push(node.id);
      }
    }

    return result;
  }

  calculateEmergencySupplyRoutes(): EmergencySupplyRoute[] {
    const deficitNodes = this.getSupplyDeficitNodes();
    const routes: EmergencySupplyRoute[] = [];

    for (const nodeId of deficitNodes) {
      const nearest = this.findNearestSupplyPoint(nodeId);
      if (nearest && nearest.nodeId !== nodeId) {
        routes.push({
          fromNodeId: nodeId,
          toSupplyNodeId: nearest.nodeId,
          path: nearest.path.path,
          segments: nearest.path.segments,
          totalLength: nearest.distance,
          maxRisk: nearest.path.maxRisk,
          riskScore: nearest.path.riskScore
        });
      }
    }

    return routes.sort((a, b) => b.riskScore - a.riskScore);
  }

  getSupplyDeficitNodes(): string[] {
    const results: string[] = [];
    for (const node of this.nodes) {
      if (node.isBlocked) continue;
      const assessment = this.assessNodeSupplyAdequacy(node.id);
      if (assessment && (assessment.overallLevel === 'deficit' || assessment.overallLevel === 'critical')) {
        results.push(node.id);
      }
    }
    return results;
  }

  getSupplyCriticalNodes(): string[] {
    const results: string[] = [];
    for (const node of this.nodes) {
      if (node.isBlocked) continue;
      const assessment = this.assessNodeSupplyAdequacy(node.id);
      if (assessment && assessment.overallLevel === 'critical') {
        results.push(node.id);
      }
    }
    return results;
  }

  getSupplyAnalysis(): SupplyAnalysis {
    const supplyNodes = this.getSupplyNodesWithSupplies();
    const totalWeight = supplyNodes.reduce((sum, n) => sum + this.getTotalSuppliesWeight(n.id), 0);

    const assessments: NodeSupplyAssessment[] = [];
    for (const node of this.nodes) {
      if (node.isBlocked) continue;
      const assessment = this.assessNodeSupplyAdequacy(node.id);
      if (assessment) {
        assessments.push(assessment);
      }
    }

    const deficitNodes = assessments.filter(a => a.overallLevel === 'deficit' || a.overallLevel === 'critical').map(a => a.nodeId);
    const criticalNodes = assessments.filter(a => a.overallLevel === 'critical').map(a => a.nodeId);
    const recommendations = this.recommendSupplyPlacements(3);
    const emergencyRoutes = this.calculateEmergencySupplyRoutes();

    return {
      totalSupplyNodes: supplyNodes.length,
      totalSuppliesWeight: totalWeight,
      supplyAssessments: assessments,
      deficitNodes,
      criticalNodes,
      placementRecommendations: recommendations,
      emergencyRoutes,
      consumptionRates: [...this.consumptionRates],
      estimatedDurationHours: this.estimatedDurationHours
    };
  }

  recalculateSupplyOnRouteChange(): void {
    this.nodes$.next([...this.nodes]);
  }

  getAnalysis(): Observable<GraphAnalysis> {
    return combineLatest([
      this.nodes$,
      this.segments$,
      this.teamConfig$,
      this.consumptionRates$,
      this.estimatedDurationHours$,
      this.simulationMode$,
      this.simulatedRemovedNodes$,
      this.simulatedRemovedSegments$
    ]).pipe(
      map(([nodes, segments, teamConfig]) => {
        const simMode = this.isSimulationMode;
        const simRemovedNodes = this.simulatedRemovedNodes;
        const simRemovedSegments = this.simulatedRemovedSegments;

        const totalLength = segments.filter(
          s => !s.isBlocked && !(simMode && simRemovedSegments.includes(s.id))
        ).reduce((sum, s) => sum + s.length, 0);
        const overloadedAnchors = this.getAnchorLoads().filter(a => a.isOverloaded);
        const disconnectedNodes = this.getDisconnectedNodes();
        const entranceNodes = nodes.filter(
          n => n.type === 'entrance' && !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id))
        ).map(n => n.id);
        const dynamicAnchorLoads = this.getDynamicAnchorLoads();
        const highlights = this.getGraphHighlights();
        const supplyAnalysis = this.getSupplyAnalysis();

        return {
          totalLength,
          nodeCount: nodes.filter(
            n => !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id))
          ).length,
          segmentCount: segments.filter(
            s => !s.isBlocked && !(simMode && simRemovedSegments.includes(s.id))
          ).length,
          overloadedAnchors,
          disconnectedNodes,
          entranceNodes,
          dynamicAnchorLoads,
          highlights,
          supplyAnalysis
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

    const supplyPoints = this.getSupplyNodesWithSupplies().map(n => n.id);
    const supplyDeficitNodes = this.getSupplyDeficitNodes();
    const supplyCriticalNodes = this.getSupplyCriticalNodes();
    const recommendations = this.recommendSupplyPlacements(3).map(r => r.nodeId);
    const emergencyRoutes = this.calculateEmergencySupplyRoutes().map(r => ({
      segments: r.segments,
      nodes: r.path
    }));

    return {
      keyAnchors,
      bottleneckSegments,
      unreachableNodes,
      safestPath,
      dangerZones,
      supplyPoints,
      supplyDeficitNodes,
      supplyCriticalNodes,
      recommendedSupplyPoints: recommendations,
      emergencySupplyRoutes: emergencyRoutes
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
    const simMode = this.isSimulationMode;
    const simRemovedNodes = this.simulatedRemovedNodes;
    const simRemovedSegments = this.simulatedRemovedSegments;

    for (const segment of this.segments) {
      if (considerBlocked && segment.isBlocked) continue;
      if (simMode && simRemovedSegments.includes(segment.id)) continue;

      const sourceNode = this.nodes.find(n => n.id === segment.sourceId);
      const targetNode = this.nodes.find(n => n.id === segment.targetId);
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

  saveRouteVersion(name: string, description?: string): RouteVersion {
    const version: RouteVersion = {
      id: `version-${this.nextVersionId++}`,
      name,
      description,
      createdAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      segments: JSON.parse(JSON.stringify(this.segments)),
      teamConfig: JSON.parse(JSON.stringify(this.teamConfig)),
      consumptionRates: JSON.parse(JSON.stringify(this.consumptionRates)),
      estimatedDurationHours: this.estimatedDurationHours
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
      if (version.consumptionRates) {
        this.consumptionRates$.next(JSON.parse(JSON.stringify(version.consumptionRates)));
      }
      if (version.estimatedDurationHours !== undefined) {
        this.estimatedDurationHours$.next(version.estimatedDurationHours);
      }
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
    const changedSegmentDetails: { id: string; changes: string[] }[] = [];
    for (const segId of segIdsA) {
      if (segIdsB.has(segId)) {
        const segA = versionA.segments.find(s => s.id === segId);
        const segB = versionB.segments.find(s => s.id === segId);
        if (segA && segB) {
          const changes: string[] = [];
          if (segA.length !== segB.length) changes.push(`长度: ${segA.length}m → ${segB.length}m`);
          if (segA.riskLevel !== segB.riskLevel) changes.push(`风险: ${segA.riskLevel} → ${segB.riskLevel}`);
          if (segA.maxLoad !== segB.maxLoad) changes.push(`承载: ${segA.maxLoad} → ${segB.maxLoad}`);
          if (segA.sourceId !== segB.sourceId || segA.targetId !== segB.targetId) changes.push('连接节点变更');
          const dirA = segA.traversalDirection || 'bidirectional';
          const dirB = segB.traversalDirection || 'bidirectional';
          if (dirA !== dirB) {
            const dirMap: Record<string, string> = {
              'bidirectional': '双向',
              'sourceToTarget': '正向(源→目标)',
              'targetToSource': '反向(目标→源)'
            };
            changes.push(`通行方向: ${dirMap[dirA]} → ${dirMap[dirB]}`);
          }
          if (segA.isBlocked !== segB.isBlocked) {
            changes.push(segB.isBlocked ? '状态: 已封锁' : '状态: 已解除封锁');
          }
          if (changes.length > 0) {
            changedSegments.push(segId);
            changedSegmentDetails.push({ id: segId, changes });
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
      changedSegmentDetails,
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
    this.consumptionRates$.next(JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES)));
    this.estimatedDurationHours$.next(4);
    this.simulationMode$.next(false);
    this.simulatedRemovedNodes$.next([]);
    this.simulatedRemovedSegments$.next([]);
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
      { id: 'entrance-2', name: '紧急出口', type: 'entrance', x: 150, y: 350, description: '备用紧急出口' },
      {
        id: 'supply-1', name: '一号补给站', type: 'supply', x: 350, y: 220, description: '入口附近主要补给站',
        supplies: [
          { type: 'oxygen', quantity: 8, unitWeight: 5, minSafetyStock: 4, priority: 'critical' },
          { type: 'medicine', quantity: 15, unitWeight: 0.5, minSafetyStock: 10, priority: 'high' },
          { type: 'lighting', quantity: 12, unitWeight: 0.3, minSafetyStock: 6, priority: 'high' },
          { type: 'battery', quantity: 20, unitWeight: 0.8, minSafetyStock: 10, priority: 'medium' },
          { type: 'food', quantity: 30, unitWeight: 0.5, minSafetyStock: 15, priority: 'medium' }
        ]
      },
      {
        id: 'supply-2', name: '二号补给站', type: 'supply', x: 570, y: 420, description: '地下深处备用补给站',
        supplies: [
          { type: 'oxygen', quantity: 5, unitWeight: 5, minSafetyStock: 3, priority: 'critical' },
          { type: 'medicine', quantity: 8, unitWeight: 0.5, minSafetyStock: 5, priority: 'high' },
          { type: 'lighting', quantity: 8, unitWeight: 0.3, minSafetyStock: 4, priority: 'high' },
          { type: 'battery', quantity: 12, unitWeight: 0.8, minSafetyStock: 6, priority: 'medium' },
          { type: 'food', quantity: 20, unitWeight: 0.5, minSafetyStock: 10, priority: 'medium' }
        ]
      }
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
      { id: 'seg-11', sourceId: 'platform-1', targetId: 'entrance-2', length: 25, slope: -20, maxLoad: 180, riskLevel: 'medium', description: '通往紧急出口' },
      { id: 'seg-12', sourceId: 'anchor-1', targetId: 'supply-1', length: 8, slope: 20, maxLoad: 150, riskLevel: 'low', description: '通往一号补给站' },
      { id: 'seg-13', sourceId: 'supply-1', targetId: 'platform-1', length: 12, slope: 25, maxLoad: 150, riskLevel: 'low', description: '补给站至第一平台' },
      { id: 'seg-14', sourceId: 'anchor-2', targetId: 'supply-2', length: 10, slope: 30, maxLoad: 150, riskLevel: 'low', description: '通往二号补给站' },
      { id: 'seg-15', sourceId: 'supply-2', targetId: 'platform-2', length: 15, slope: 40, maxLoad: 150, riskLevel: 'medium', description: '补给站至地下大厅' }
    ];

    this.nodes$.next(sampleNodes);
    this.segments$.next(sampleSegments);
    this.nextNodeId = 14;
    this.nextSegmentId = 16;

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

    this.consumptionRates$.next(JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES)));
    this.estimatedDurationHours$.next(8);
  }
}
