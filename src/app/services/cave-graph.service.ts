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
  DEFAULT_CONSUMPTION_RATES,
  CommDevice,
  CommDeviceType,
  RelayStation,
  PositioningBeacon,
  DistressPoint,
  NodeCommCoverage,
  SegmentSignalInfo,
  RelayPlacementRecommendation as CommRelayRecommendation,
  DistressReachableInfo,
  PositioningContinuityResult,
  CommAnalysis,
  SignalQuality,
  CommCoverageLevel,
  COMM_DEVICE_TYPE_MAP,
  SIGNAL_QUALITY_MAP,
  COMM_COVERAGE_LEVEL_MAP,
  DEFAULT_COMM_DEVICE_CONFIG
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
  private commDevices$ = new BehaviorSubject<CommDevice[]>([]);

  private nextNodeId = 1;
  private nextSegmentId = 1;
  private nextVersionId = 1;
  private nextMemberId = 1;
  private nextCommDeviceId = 1;

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

  get commDevices(): CommDevice[] {
    return this.commDevices$.value;
  }

  getCommDevices(): Observable<CommDevice[]> {
    return this.commDevices$.asObservable();
  }

  getCommDevicesByType(type: CommDeviceType): CommDevice[] {
    return this.commDevices.filter(d => d.type === type && d.isOnline);
  }

  getCommDeviceById(id: string): CommDevice | undefined {
    return this.commDevices.find(d => d.id === id);
  }

  getCommDevicesByNodeId(nodeId: string): CommDevice[] {
    return this.commDevices.filter(d => d.nodeId === nodeId);
  }

  addCommDevice(device: Omit<CommDevice, 'id'> & { id?: string }): CommDevice {
    const node = this.nodes.find(n => n.id === device.nodeId);
    if (!node) {
      throw new Error('节点不存在，无法部署设备');
    }
    const id = device.id || `comm-${this.nextCommDeviceId++}`;
    if (this.commDevices.some(d => d.id === id)) {
      throw new Error(`设备编号 ${id} 已存在`);
    }

    const newDevice: CommDevice = {
      id,
      nodeId: device.nodeId,
      type: device.type,
      name: device.name,
      description: device.description,
      coverageRadius: device.coverageRadius,
      batteryLevel: device.batteryLevel,
      batteryCapacity: device.batteryCapacity,
      signalStrength: device.signalStrength,
      isOnline: device.isOnline !== undefined ? device.isOnline : true,
      frequency: device.frequency,
      lastCheckIn: device.lastCheckIn || Date.now(),
      ...(device.type === 'relay' ? {
        maxConnections: (device as any).maxConnections ?? DEFAULT_COMM_DEVICE_CONFIG.relay.maxConnections,
        supportedChannels: (device as any).supportedChannels ?? DEFAULT_COMM_DEVICE_CONFIG.relay.supportedChannels,
        backhaulNodeId: (device as any).backhaulNodeId
      } : {}),
      ...(device.type === 'beacon' ? {
        positioningAccuracy: (device as any).positioningAccuracy ?? DEFAULT_COMM_DEVICE_CONFIG.beacon.positioningAccuracy,
        updateInterval: (device as any).updateInterval ?? DEFAULT_COMM_DEVICE_CONFIG.beacon.updateInterval,
        isActive: (device as any).isActive ?? DEFAULT_COMM_DEVICE_CONFIG.beacon.isActive
      } : {}),
      ...(device.type === 'distress' ? {
        alarmTriggered: (device as any).alarmTriggered ?? false,
        lastAlarmTime: (device as any).lastAlarmTime,
        hasAudio: (device as any).hasAudio ?? DEFAULT_COMM_DEVICE_CONFIG.distress.hasAudio,
        hasVideo: (device as any).hasVideo ?? DEFAULT_COMM_DEVICE_CONFIG.distress.hasVideo
      } : {})
    } as CommDevice;

    const updated = [...this.commDevices, newDevice];
    this.commDevices$.next(updated);
    return newDevice;
  }

  updateCommDevice(id: string, updates: Partial<Omit<CommDevice, 'id' | 'type'>>): CommDevice | null {
    const index = this.commDevices.findIndex(d => d.id === id);
    if (index === -1) return null;
    const updated = [...this.commDevices];
    updated[index] = { ...updated[index], ...updates, lastCheckIn: Date.now() };
    this.commDevices$.next(updated);
    return updated[index];
  }

  deleteCommDevice(id: string): void {
    const updated = this.commDevices.filter(d => d.id !== id);
    this.commDevices$.next(updated);
  }

  toggleCommDeviceOnline(id: string): void {
    const device = this.commDevices.find(d => d.id === id);
    if (device) {
      this.updateCommDevice(id, { isOnline: !device.isOnline });
    }
  }

  triggerDistressAlarm(id: string): void {
    const device = this.commDevices.find(d => d.id === id && d.type === 'distress');
    if (device) {
      this.updateCommDevice(id, { alarmTriggered: true, lastAlarmTime: Date.now() } as any);
    }
  }

  resetDistressAlarm(id: string): void {
    const device = this.commDevices.find(d => d.id === id && d.type === 'distress');
    if (device) {
      this.updateCommDevice(id, { alarmTriggered: false } as any);
    }
  }

  private getEuclideanDistance(nodeA: CaveNode, nodeB: CaveNode): number {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateSignalStrength(distance: number, device: CommDevice): number {
    if (!device.isOnline) return 0;
    if (distance <= 0) return device.signalStrength;
    if (distance >= device.coverageRadius) return 0;

    const ratio = 1 - (distance / device.coverageRadius);
    const falloff = Math.pow(ratio, 1.5);
    return Math.max(0, device.signalStrength * falloff);
  }

  private getSignalQuality(strength: number): SignalQuality {
    if (strength >= 80) return 'excellent';
    if (strength >= 60) return 'good';
    if (strength >= 40) return 'fair';
    if (strength >= 20) return 'poor';
    return 'none';
  }

  private getCoverageLevel(quality: SignalQuality): CommCoverageLevel {
    if (quality === 'excellent' || quality === 'good') return 'full';
    if (quality === 'fair') return 'partial';
    if (quality === 'poor') return 'weak';
    return 'none';
  }

  getNodeCommCoverage(nodeId: string): NodeCommCoverage | null {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || node.isBlocked) return null;

    const activeDevices = this.commDevices.filter(d => d.isOnline);
    if (activeDevices.length === 0) {
      return {
        nodeId,
        nodeName: node.name,
        coverageLevel: 'none',
        signalQuality: 'none',
        signalStrength: 0,
        coveringDeviceIds: [],
        distanceToNearestDevice: Infinity
      };
    }

    let maxSignal = 0;
    let minDistance = Infinity;
    const coveringDevices: string[] = [];

    for (const device of activeDevices) {
      const deviceNode = this.nodes.find(n => n.id === device.nodeId);
      if (!deviceNode || deviceNode.isBlocked) continue;

      const distance = this.getEuclideanDistance(node, deviceNode);
      const signal = this.calculateSignalStrength(distance, device);

      if (signal > 0) {
        coveringDevices.push(device.id);
      }
      if (signal > maxSignal) {
        maxSignal = signal;
      }
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    const signalQuality = this.getSignalQuality(maxSignal);
    const coverageLevel = this.getCoverageLevel(signalQuality);

    return {
      nodeId,
      nodeName: node.name,
      coverageLevel,
      signalQuality,
      signalStrength: maxSignal,
      coveringDeviceIds: coveringDevices,
      distanceToNearestDevice: minDistance === Infinity ? -1 : minDistance
    };
  }

  getSegmentSignalInfo(segmentId: string): SegmentSignalInfo | null {
    const segment = this.segments.find(s => s.id === segmentId);
    if (!segment || segment.isBlocked) return null;

    const sourceNode = this.nodes.find(n => n.id === segment.sourceId);
    const targetNode = this.nodes.find(n => n.id === segment.targetId);
    if (!sourceNode || !targetNode) return null;

    const activeDevices = this.commDevices.filter(d => d.isOnline);
    if (activeDevices.length === 0) {
      return {
        segmentId,
        avgSignalStrength: 0,
        minSignalStrength: 0,
        signalQuality: 'none',
        isWeakSignal: true,
        isBlindSpot: true,
        coveragePercent: 0
      };
    }

    const samplePoints = 5;
    const signals: number[] = [];

    for (let i = 0; i <= samplePoints; i++) {
      const t = i / samplePoints;
      const pointX = sourceNode.x + (targetNode.x - sourceNode.x) * t;
      const pointY = sourceNode.y + (targetNode.y - sourceNode.y) * t;

      let maxSignal = 0;
      for (const device of activeDevices) {
        const deviceNode = this.nodes.find(n => n.id === device.nodeId);
        if (!deviceNode || deviceNode.isBlocked) continue;

        const dx = pointX - deviceNode.x;
        const dy = pointY - deviceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const signal = this.calculateSignalStrength(distance, device);

        if (signal > maxSignal) {
          maxSignal = signal;
        }
      }
      signals.push(maxSignal);
    }

    const avgSignal = signals.reduce((a, b) => a + b, 0) / signals.length;
    const minSignal = Math.min(...signals);
    const coveredPoints = signals.filter(s => s > 20).length;
    const coveragePercent = (coveredPoints / signals.length) * 100;

    const signalQuality = this.getSignalQuality(avgSignal);
    const isWeakSignal = avgSignal < 40 && avgSignal > 0;
    const isBlindSpot = avgSignal <= 0;

    return {
      segmentId,
      avgSignalStrength: avgSignal,
      minSignalStrength: minSignal,
      signalQuality,
      isWeakSignal,
      isBlindSpot,
      coveragePercent
    };
  }

  recommendRelayPlacements(maxRecommendations: number = 3): CommRelayRecommendation[] {
    const allNodes = this.nodes.filter(n => !n.isBlocked && n.type !== 'danger');
    const existingRelayNodeIds = new Set(
      this.commDevices.filter(d => d.type === 'relay' && d.isOnline).map(d => d.nodeId)
    );

    const candidates: CommRelayRecommendation[] = [];

    for (const node of allNodes) {
      if (existingRelayNodeIds.has(node.id)) continue;

      const currentCoverage = this.getNodeCommCoverage(node.id);
      if (currentCoverage && currentCoverage.coverageLevel !== 'none') continue;

      const testDevice: CommDevice = {
        id: 'test-relay',
        nodeId: node.id,
        type: 'relay',
        name: '测试中继',
        coverageRadius: COMM_DEVICE_TYPE_MAP.relay.defaultRadius,
        batteryLevel: 100,
        batteryCapacity: 100,
        signalStrength: COMM_DEVICE_TYPE_MAP.relay.defaultSignal,
        isOnline: true
      };

      let coverageGain = 0;
      const coveredNodes: string[] = [];
      const coveredSegments: string[] = [];

      for (const otherNode of allNodes) {
        if (otherNode.id === node.id) continue;
        const existingCov = this.getNodeCommCoverage(otherNode.id);
        if (existingCov && existingCov.coverageLevel !== 'none') continue;

        const distance = this.getEuclideanDistance(node, otherNode);
        if (distance <= testDevice.coverageRadius) {
          coverageGain++;
          coveredNodes.push(otherNode.id);
        }
      }

      for (const seg of this.segments.filter(s => !s.isBlocked)) {
        const segInfo = this.getSegmentSignalInfo(seg.id);
        if (segInfo && !segInfo.isBlindSpot) continue;

        const sourceNode = this.nodes.find(n => n.id === seg.sourceId);
        const targetNode = this.nodes.find(n => n.id === seg.targetId);
        if (!sourceNode || !targetNode) continue;

        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        const distToMid = Math.sqrt(
          Math.pow(midX - node.x, 2) + Math.pow(midY - node.y, 2)
        );

        if (distToMid <= testDevice.coverageRadius) {
          coveredSegments.push(seg.id);
        }
      }

      let score = 0;
      const reasons: string[] = [];

      if (coveredNodes.length >= 3) {
        score += 40;
        reasons.push(`可覆盖 ${coveredNodes.length} 个盲区节点`);
      } else if (coveredNodes.length > 0) {
        score += coveredNodes.length * 10;
        reasons.push(`覆盖 ${coveredNodes.length} 个盲区节点`);
      }

      if (coveredSegments.length >= 2) {
        score += 30;
        reasons.push(`可改善 ${coveredSegments.length} 条绳段信号`);
      } else if (coveredSegments.length > 0) {
        score += coveredSegments.length * 12;
      }

      const connectedSegments = this.segments.filter(
        s => !s.isBlocked && (s.sourceId === node.id || s.targetId === node.id)
      );
      if (connectedSegments.length >= 3) {
        score += 20;
        reasons.push('位于路线交汇点');
      }

      if (node.type === 'platform') {
        score += 10;
        reasons.push('平台节点便于部署');
      }

      const pathsToEntrance = this.findPathsToEntrance(node.id);
      if (pathsToEntrance.length > 0 && pathsToEntrance[0].totalLength > 50) {
        score += 15;
        reasons.push('深入洞穴内部');
      }

      if (score > 25) {
        candidates.push({
          nodeId: node.id,
          nodeName: node.name,
          score,
          reason: reasons.join('；'),
          estimatedCoverageGain: coverageGain,
          coveredNodes,
          coveredSegments,
          recommendedRadius: testDevice.coverageRadius
        });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRecommendations);
  }

  getDistressReachability(fromNodeId: string): DistressReachableInfo | null {
    const node = this.nodes.find(n => n.id === fromNodeId);
    if (!node || node.isBlocked) return null;

    const distressDevices = this.commDevices.filter(d => d.type === 'distress' && d.isOnline);
    if (distressDevices.length === 0) {
      return {
        nodeId: fromNodeId,
        nodeName: node.name,
        isReachable: false,
        distanceToDistress: Infinity,
        signalQuality: 'none'
      };
    }

    let nearest: { device: CommDevice; distance: number; path: PathResult } | null = null;

    for (const device of distressDevices) {
      const deviceNode = this.nodes.find(n => n.id === device.nodeId);
      if (!deviceNode || deviceNode.isBlocked) continue;

      const paths = this.findPathsBetween(fromNodeId, device.nodeId);
      if (paths.length > 0) {
        const shortest = paths[0];
        if (!nearest || shortest.totalLength < nearest.distance) {
          nearest = { device, distance: shortest.totalLength, path: shortest };
        }
      }
    }

    if (!nearest) {
      return {
        nodeId: fromNodeId,
        nodeName: node.name,
        isReachable: false,
        distanceToDistress: Infinity,
        signalQuality: 'none'
      };
    }

    const deviceNode = this.nodes.find(n => n.id === nearest.device.nodeId);
    let signalStrength = 0;
    if (deviceNode) {
      const distance = this.getEuclideanDistance(node, deviceNode);
      signalStrength = this.calculateSignalStrength(distance, nearest.device);
    }

    const signalQuality = this.getSignalQuality(signalStrength);

    return {
      nodeId: fromNodeId,
      nodeName: node.name,
      isReachable: true,
      nearestDistressId: nearest.device.id,
      nearestDistressName: nearest.device.name,
      distanceToDistress: nearest.distance,
      pathToDistress: nearest.path.path,
      pathSegments: nearest.path.segments,
      signalQuality
    };
  }

  analyzePositioningContinuity(pathNodeIds: string[]): PositioningContinuityResult | null {
    if (pathNodeIds.length < 2) return null;

    const beacons = this.commDevices.filter(d => d.type === 'beacon' && d.isOnline);
    const gapNodes: string[] = [];
    const gapSegments: string[] = [];
    let coveredCount = 0;

    for (let i = 0; i < pathNodeIds.length; i++) {
      const nodeId = pathNodeIds[i];
      const coverage = this.getNodeCommCoverage(nodeId);

      if (coverage && coverage.coverageLevel !== 'none') {
        coveredCount++;
      } else {
        gapNodes.push(nodeId);
      }
    }

    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      const sourceId = pathNodeIds[i];
      const targetId = pathNodeIds[i + 1];
      const segment = this.segments.find(
        s => !s.isBlocked &&
          ((s.sourceId === sourceId && s.targetId === targetId) ||
           (s.sourceId === targetId && s.targetId === sourceId))
      );

      if (segment) {
        const sigInfo = this.getSegmentSignalInfo(segment.id);
        if (sigInfo && sigInfo.isBlindSpot) {
          gapSegments.push(segment.id);
        }
      }
    }

    const continuityPercent = pathNodeIds.length > 0
      ? (coveredCount / pathNodeIds.length) * 100
      : 0;

    return {
      pathNodes: pathNodeIds,
      pathSegments: gapSegments,
      continuityPercent,
      gapSegments,
      gapNodes,
      hasContinuousCoverage: continuityPercent >= 80,
      beaconCount: beacons.length
    };
  }

  getCommAnalysis(): CommAnalysis {
    const devices = this.commDevices;
    const relays = devices.filter(d => d.type === 'relay');
    const beacons = devices.filter(d => d.type === 'beacon');
    const distresses = devices.filter(d => d.type === 'distress');
    const onlineDevices = devices.filter(d => d.isOnline);
    const offlineDevices = devices.filter(d => !d.isOnline);

    const avgBattery = devices.length > 0
      ? devices.reduce((sum, d) => sum + d.batteryLevel, 0) / devices.length
      : 0;

    const nodeCoverages: NodeCommCoverage[] = [];
    const blindSpotNodes: string[] = [];
    const fullCoverageNodes: string[] = [];

    for (const node of this.nodes.filter(n => !n.isBlocked)) {
      const coverage = this.getNodeCommCoverage(node.id);
      if (coverage) {
        nodeCoverages.push(coverage);
        if (coverage.coverageLevel === 'none') {
          blindSpotNodes.push(node.id);
        }
        if (coverage.coverageLevel === 'full') {
          fullCoverageNodes.push(node.id);
        }
      }
    }

    const segmentSignals: SegmentSignalInfo[] = [];
    const weakSignalSegments: string[] = [];

    for (const segment of this.segments.filter(s => !s.isBlocked)) {
      const sigInfo = this.getSegmentSignalInfo(segment.id);
      if (sigInfo) {
        segmentSignals.push(sigInfo);
        if (sigInfo.isWeakSignal || sigInfo.isBlindSpot) {
          weakSignalSegments.push(segment.id);
        }
      }
    }

    const relayRecommendations = this.recommendRelayPlacements(3);

    const distressReachability: DistressReachableInfo[] = [];
    const unreachableDistressNodes: string[] = [];

    for (const node of this.nodes.filter(n => !n.isBlocked)) {
      const reachability = this.getDistressReachability(node.id);
      if (reachability) {
        distressReachability.push(reachability);
        if (!reachability.isReachable) {
          unreachableDistressNodes.push(node.id);
        }
      }
    }

    let avgContinuity = 0;
    const entranceNodes = this.nodes.filter(n => n.type === 'entrance' && !n.isBlocked);
    if (entranceNodes.length > 0) {
      let totalContinuity = 0;
      let pathCount = 0;
      for (const entrance of entranceNodes) {
        const paths = this.findPathsToEntrance(entrance.id);
        for (const path of paths.slice(0, 3)) {
          const continuity = this.analyzePositioningContinuity(path.path);
          if (continuity) {
            totalContinuity += continuity.continuityPercent;
            pathCount++;
          }
        }
      }
      avgContinuity = pathCount > 0 ? totalContinuity / pathCount : 0;
    }

    return {
      totalDevices: devices.length,
      relayCount: relays.length,
      beaconCount: beacons.length,
      distressCount: distresses.length,
      onlineCount: onlineDevices.length,
      offlineCount: offlineDevices.length,
      avgBatteryLevel: avgBattery,
      nodeCoverages,
      segmentSignals,
      blindSpotNodes,
      weakSignalSegments,
      fullCoverageNodes,
      relayRecommendations,
      distressReachability,
      unreachableDistressNodes,
      avgPositioningContinuity: avgContinuity
    };
  }

  recalculateCommOnRouteChange(): void {
    this.commDevices$.next([...this.commDevices]);
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
      this.simulatedRemovedSegments$,
      this.commDevices$
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
        const commAnalysis = this.getCommAnalysis();

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
          supplyAnalysis,
          commAnalysis
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

    const commRelayNodes = this.commDevices.filter(d => d.type === 'relay' && d.isOnline).map(d => d.nodeId);
    const commBeaconNodes = this.commDevices.filter(d => d.type === 'beacon' && d.isOnline).map(d => d.nodeId);
    const commDistressNodes = this.commDevices.filter(d => d.type === 'distress' && d.isOnline).map(d => d.nodeId);
    const commOfflineNodes = this.commDevices.filter(d => !d.isOnline).map(d => d.nodeId);

    const commAnalysis = this.getCommAnalysis();
    const commBlindSpotNodes = commAnalysis.blindSpotNodes;
    const commWeakSignalSegments = commAnalysis.weakSignalSegments;
    const commRecommendedRelayNodes = commAnalysis.relayRecommendations.map(r => r.nodeId);

    const commDistressRoutes = commAnalysis.distressReachability
      .filter(r => r.isReachable && r.pathSegments && r.pathToDistress)
      .map(r => ({
        segments: r.pathSegments || [],
        nodes: r.pathToDistress || []
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
      emergencySupplyRoutes: emergencyRoutes,
      commRelayNodes,
      commBeaconNodes,
      commDistressNodes,
      commBlindSpotNodes,
      commWeakSignalSegments,
      commRecommendedRelayNodes,
      commDistressRoutes,
      commOfflineNodes
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
      estimatedDurationHours: this.estimatedDurationHours,
      commDevices: JSON.parse(JSON.stringify(this.commDevices))
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
      if (version.commDevices) {
        this.commDevices$.next(JSON.parse(JSON.stringify(version.commDevices)));
        const maxId = version.commDevices.reduce((max, d) => {
          const num = parseInt(d.id.replace('comm-', ''));
          return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        this.nextCommDeviceId = maxId + 1;
      } else {
        this.commDevices$.next([]);
        this.nextCommDeviceId = 1;
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
    this.commDevices$.next([]);
    this.nextCommDeviceId = 1;
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

    const sampleCommDevices: CommDevice[] = [
      {
        id: 'comm-1',
        nodeId: 'entrance-1',
        type: 'relay',
        name: '入口主中继',
        description: '洞穴入口主中继台，负责地面通信',
        coverageRadius: 100,
        batteryLevel: 100,
        batteryCapacity: 100,
        signalStrength: 95,
        isOnline: true,
        frequency: '433MHz',
        lastCheckIn: Date.now(),
        maxConnections: 20,
        supportedChannels: 16
      } as RelayStation,
      {
        id: 'comm-2',
        nodeId: 'platform-1',
        type: 'beacon',
        name: '一号平台信标',
        description: '第一平台定位信标',
        coverageRadius: 60,
        batteryLevel: 85,
        batteryCapacity: 100,
        signalStrength: 80,
        isOnline: true,
        frequency: '2.4GHz',
        lastCheckIn: Date.now(),
        positioningAccuracy: 2,
        updateInterval: 3,
        isActive: true
      } as PositioningBeacon,
      {
        id: 'comm-3',
        nodeId: 'platform-2',
        type: 'relay',
        name: '地下大厅中继',
        description: '地下大厅中继台，覆盖深处区域',
        coverageRadius: 90,
        batteryLevel: 70,
        batteryCapacity: 100,
        signalStrength: 88,
        isOnline: true,
        frequency: '433MHz',
        lastCheckIn: Date.now(),
        maxConnections: 15,
        supportedChannels: 12
      } as RelayStation,
      {
        id: 'comm-4',
        nodeId: 'platform-2',
        type: 'distress',
        name: '大厅求救点',
        description: '地下大厅紧急求救终端',
        coverageRadius: 70,
        batteryLevel: 95,
        batteryCapacity: 100,
        signalStrength: 92,
        isOnline: true,
        frequency: '应急频道',
        lastCheckIn: Date.now(),
        alarmTriggered: false,
        hasAudio: true,
        hasVideo: false
      } as DistressPoint,
      {
        id: 'comm-5',
        nodeId: 'anchor-4',
        type: 'beacon',
        name: '主通道信标',
        description: '主通道关键定位信标',
        coverageRadius: 50,
        batteryLevel: 60,
        batteryCapacity: 100,
        signalStrength: 75,
        isOnline: true,
        frequency: '2.4GHz',
        lastCheckIn: Date.now(),
        positioningAccuracy: 3,
        updateInterval: 5,
        isActive: true
      } as PositioningBeacon,
      {
        id: 'comm-6',
        nodeId: 'supply-1',
        type: 'distress',
        name: '一号补给站求救点',
        description: '入口附近求救终端',
        coverageRadius: 65,
        batteryLevel: 88,
        batteryCapacity: 100,
        signalStrength: 90,
        isOnline: false,
        frequency: '应急频道',
        lastCheckIn: Date.now() - 3600000,
        alarmTriggered: false,
        hasAudio: true,
        hasVideo: true
      } as DistressPoint
    ];

    this.commDevices$.next(sampleCommDevices);
    this.nextCommDeviceId = 7;
  }
}
