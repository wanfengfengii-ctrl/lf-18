import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GraphStateService } from '../../core/state/graph-state.service';
import {
  CaveNode,
  RopeSegment,
  RiskLevel,
  SupplyItem,
  SupplyType,
  SupplyAdequacyLevel,
  SupplyAdequacyItem,
  NodeSupplyAssessment,
  SupplyPlacementRecommendation,
  EmergencySupplyRoute,
  SupplyAnalysis,
  SupplyConsumptionRate,
  PathResult,
  TeamConfig,
  DEFAULT_CONSUMPTION_RATES,
  TraversalDirection
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class SupplyService {
  private consumptionRates$ = new BehaviorSubject<SupplyConsumptionRate[]>(
    JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES))
  );
  private estimatedDurationHours$ = new BehaviorSubject<number>(8);
  private teamConfig$ = new BehaviorSubject<TeamConfig>({
    members: [],
    passingOrder: [],
    safetyFactor: 1.5
  });

  private riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  constructor(private graphState: GraphStateService) {}

  get consumptionRates(): SupplyConsumptionRate[] {
    return this.consumptionRates$.value;
  }

  get estimatedDurationHours(): number {
    return this.estimatedDurationHours$.value;
  }

  get teamConfig(): TeamConfig {
    return this.teamConfig$.value;
  }

  getConsumptionRates(): Observable<SupplyConsumptionRate[]> {
    return this.consumptionRates$.asObservable();
  }

  setConsumptionRates(rates: SupplyConsumptionRate[]): void {
    this.consumptionRates$.next([...rates]);
  }

  getEstimatedDurationHours(): Observable<number> {
    return this.estimatedDurationHours$.asObservable();
  }

  setEstimatedDurationHours(hours: number): void {
    this.estimatedDurationHours$.next(Math.max(1, hours));
  }

  getTeamConfig(): Observable<TeamConfig> {
    return this.teamConfig$.asObservable();
  }

  setTeamConfig(config: TeamConfig): void {
    this.teamConfig$.next({ ...config });
  }

  getSupplyNodes(): CaveNode[] {
    return this.graphState.nodes.filter(n => n.type === 'supply' && !n.isBlocked);
  }

  getNodeSupplies(nodeId: string): SupplyItem[] {
    const node = this.graphState.getNodeById(nodeId);
    return node?.supplies ? [...node.supplies] : [];
  }

  updateNodeSupplies(nodeId: string, supplies: SupplyItem[]): boolean {
    const node = this.graphState.getNodeById(nodeId);
    if (!node) return false;
    this.graphState.updateNode(nodeId, { supplies: [...supplies] });
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
    return this.graphState.nodes.filter(n =>
      n.type === 'supply' && !n.isBlocked && n.supplies && n.supplies.length > 0
    );
  }

  private calculateSupplyRequirements(
    distance: number,
    teamSize: number,
    riskLevel: RiskLevel
  ): Record<SupplyType, number> {
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

  assessNodeSupplyAdequacy(nodeId: string): NodeSupplyAssessment | null {
    const node = this.graphState.getNodeById(nodeId);
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

  findNearestSupplyPoint(
    fromNodeId: string
  ): { nodeId: string; distance: number; path: PathResult } | null {
    const supplyNodes = this.getSupplyNodesWithSupplies();
    if (supplyNodes.length === 0) return null;
    if (supplyNodes.some(n => n.id === fromNodeId)) {
      return {
        nodeId: fromNodeId,
        distance: 0,
        path: {
          path: [fromNodeId],
          totalLength: 0,
          maxRisk: 'low',
          riskScore: 0,
          avgRisk: 0,
          segments: []
        }
      };
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

  findReachableSupplyPoints(
    fromNodeId: string
  ): { nodeId: string; distance: number; path: PathResult }[] {
    const supplyNodes = this.getSupplyNodesWithSupplies();
    const results: { nodeId: string; distance: number; path: PathResult }[] = [];

    if (supplyNodes.some(n => n.id === fromNodeId)) {
      results.push({
        nodeId: fromNodeId,
        distance: 0,
        path: {
          path: [fromNodeId],
          totalLength: 0,
          maxRisk: 'low',
          riskScore: 0,
          avgRisk: 0,
          segments: []
        }
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

  private findNodesWithinDistance(fromNodeId: string, maxDistance: number): string[] {
    const result: string[] = [];
    const allNodes = this.graphState.nodes.filter(n => !n.isBlocked && n.type !== 'danger');

    for (const node of allNodes) {
      if (node.id === fromNodeId) continue;
      const paths = this.findPathsBetween(fromNodeId, node.id);
      if (paths.length > 0 && paths[0].totalLength <= maxDistance) {
        result.push(node.id);
      }
    }

    return result;
  }

  recommendSupplyPlacements(maxRecommendations: number = 3): SupplyPlacementRecommendation[] {
    const allNodes = this.graphState.nodes.filter(n => !n.isBlocked && n.type !== 'danger');
    const existingSupplyNodeIds = new Set(this.getSupplyNodesWithSupplies().map(n => n.id));
    const teamSize = this.teamConfig.members.length;

    const candidates: SupplyPlacementRecommendation[] = [];

    for (const node of allNodes) {
      if (existingSupplyNodeIds.has(node.id)) continue;

      const paths = this.findPathsToEntrance(node.id);
      if (paths.length === 0) continue;

      const distanceToEntrance = paths[0].totalLength;
      const riskLevel = paths[0].maxRisk;
      const connectedSegments = this.graphState.segments.filter(
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
          coverageNodes
        });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRecommendations);
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
    for (const node of this.graphState.nodes) {
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
    for (const node of this.graphState.nodes) {
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
    for (const node of this.graphState.nodes) {
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
    const nodes = [...this.graphState.nodes];
    this.graphState['nodes$'].next(nodes);
  }

  private findPathsBetween(sourceId: string, targetId: string): PathResult[] {
    const results: PathResult[] = [];
    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList(true);

    const dfs = (
      currentId: string,
      path: string[],
      segPath: string[],
      totalLength: number,
      maxRisk: RiskLevel,
      totalRisk: number,
      depth: number
    ) => {
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
          dfs(
            nextId,
            [...path, nextId],
            [...segPath, segment.id],
            totalLength + segment.length,
            newRisk,
            totalRisk + riskValue,
            depth + 1
          );
        }
      }
      visited.delete(currentId);
    };

    dfs(sourceId, [sourceId], [], 0, 'low', 0, 0);
    return results.sort((a, b) => a.totalLength - b.totalLength);
  }

  private findPathsToEntrance(
    fromNodeId: string,
    options?: { useRiskWeight?: boolean; considerBlocked?: boolean }
  ): PathResult[] {
    const useRiskWeight = options?.useRiskWeight ?? false;
    const considerBlocked = options?.considerBlocked ?? true;

    const entranceNodes = this.graphState.nodes
      .filter(n => n.type === 'entrance' && (!considerBlocked || !n.isBlocked))
      .map(n => n.id);
    if (entranceNodes.length === 0) return [];
    if (entranceNodes.includes(fromNodeId)) {
      return [
        {
          path: [fromNodeId],
          totalLength: 0,
          maxRisk: 'low',
          riskScore: 0,
          avgRisk: 0,
          segments: []
        }
      ];
    }

    const results: PathResult[] = [];
    const visited = new Set<string>();
    const adjacency = this.buildAdjacencyList(considerBlocked);

    const dfs = (
      currentId: string,
      path: string[],
      segPath: string[],
      totalLength: number,
      maxRisk: RiskLevel,
      totalRisk: number,
      depth: number
    ) => {
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
          dfs(
            targetId,
            [...path, targetId],
            [...segPath, segment.id],
            totalLength + segment.length,
            newRisk,
            totalRisk + riskValue,
            depth + 1
          );
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

  private buildAdjacencyList(
    considerBlocked: boolean = true
  ): Map<string, { targetId: string; segment: RopeSegment }[]> {
    const adjacency = new Map<string, { targetId: string; segment: RopeSegment }[]>();

    for (const segment of this.graphState.segments) {
      if (considerBlocked && segment.isBlocked) continue;

      const sourceNode = this.graphState.getNodeById(segment.sourceId);
      const targetNode = this.graphState.getNodeById(segment.targetId);
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

  private calculateRiskScore(length: number, maxRisk: RiskLevel): number {
    const riskWeight = this.riskOrder[maxRisk];
    return length * (1 + riskWeight * 0.5);
  }

  private maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
    return this.riskOrder[a] >= this.riskOrder[b] ? a : b;
  }
}
