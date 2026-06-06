import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GraphStateService } from '../../core/state/graph-state.service';
import {
  CaveNode,
  RopeSegment,
  RiskLevel,
  PathResult,
  CommDevice,
  CommDeviceType,
  NodeCommCoverage,
  SegmentSignalInfo,
  RelayPlacementRecommendation,
  DistressReachableInfo,
  PositioningContinuityResult,
  CommAnalysis,
  SignalQuality,
  CommCoverageLevel,
  COMM_DEVICE_TYPE_MAP,
  DEFAULT_COMM_DEVICE_CONFIG
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class CommService {
  private commDevices$ = new BehaviorSubject<CommDevice[]>([]);
  private nextCommDeviceId = 1;

  private riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  constructor(private graphState: GraphStateService) {}

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
    const node = this.graphState.nodes.find(n => n.id === device.nodeId);
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
    const node = this.graphState.nodes.find(n => n.id === nodeId);
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
      const deviceNode = this.graphState.nodes.find(n => n.id === device.nodeId);
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
    const segment = this.graphState.segments.find(s => s.id === segmentId);
    if (!segment || segment.isBlocked) return null;

    const sourceNode = this.graphState.nodes.find(n => n.id === segment.sourceId);
    const targetNode = this.graphState.nodes.find(n => n.id === segment.targetId);
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
        const deviceNode = this.graphState.nodes.find(n => n.id === device.nodeId);
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

  private buildAdjacencyList(considerBlocked: boolean = true): Map<string, { targetId: string; segment: RopeSegment }[]> {
    const adjacency = new Map<string, { targetId: string; segment: RopeSegment }[]>();

    for (const segment of this.graphState.segments) {
      if (considerBlocked && segment.isBlocked) continue;

      const sourceNode = this.graphState.nodes.find(n => n.id === segment.sourceId);
      const targetNode = this.graphState.nodes.find(n => n.id === segment.targetId);
      if (considerBlocked && (sourceNode?.isBlocked || targetNode?.isBlocked)) continue;

      if (!adjacency.has(segment.sourceId)) {
        adjacency.set(segment.sourceId, []);
      }
      if (!adjacency.has(segment.targetId)) {
        adjacency.set(segment.targetId, []);
      }

      if (!segment.traversalDirection || segment.traversalDirection === 'bidirectional') {
        adjacency.get(segment.sourceId)!.push({ targetId: segment.targetId, segment });
        adjacency.get(segment.targetId)!.push({ targetId: segment.sourceId, segment });
      } else if (segment.traversalDirection === 'sourceToTarget') {
        adjacency.get(segment.sourceId)!.push({ targetId: segment.targetId, segment });
      } else if (segment.traversalDirection === 'targetToSource') {
        adjacency.get(segment.targetId)!.push({ targetId: segment.sourceId, segment });
      }
    }

    return adjacency;
  }

  private maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
    return this.riskOrder[a] >= this.riskOrder[b] ? a : b;
  }

  private calculateRiskScore(length: number, maxRisk: RiskLevel): number {
    const riskWeight = this.riskOrder[maxRisk];
    return length * (1 + riskWeight * 0.5);
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

  private findPathsToEntrance(fromNodeId: string, options?: { useRiskWeight?: boolean; considerBlocked?: boolean }): PathResult[] {
    const useRiskWeight = options?.useRiskWeight ?? false;
    const considerBlocked = options?.considerBlocked ?? true;

    const entranceNodes = this.graphState.nodes.filter(n => n.type === 'entrance' && (!considerBlocked || !n.isBlocked)).map(n => n.id);
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

  recommendRelayPlacements(maxRecommendations: number = 3): RelayPlacementRecommendation[] {
    const allNodes = this.graphState.nodes.filter(n => !n.isBlocked && n.type !== 'danger');
    const existingRelayNodeIds = new Set(
      this.commDevices.filter(d => d.type === 'relay' && d.isOnline).map(d => d.nodeId)
    );

    const candidates: RelayPlacementRecommendation[] = [];

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

      for (const seg of this.graphState.segments.filter(s => !s.isBlocked)) {
        const segInfo = this.getSegmentSignalInfo(seg.id);
        if (segInfo && !segInfo.isBlindSpot) continue;

        const sourceNode = this.graphState.nodes.find(n => n.id === seg.sourceId);
        const targetNode = this.graphState.nodes.find(n => n.id === seg.targetId);
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

      const connectedSegments = this.graphState.segments.filter(
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
    const node = this.graphState.nodes.find(n => n.id === fromNodeId);
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
      const deviceNode = this.graphState.nodes.find(n => n.id === device.nodeId);
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

    const deviceNode = this.graphState.nodes.find(n => n.id === nearest.device.nodeId);
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
      const segment = this.graphState.segments.find(
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

    for (const node of this.graphState.nodes.filter(n => !n.isBlocked)) {
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

    for (const segment of this.graphState.segments.filter(s => !s.isBlocked)) {
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

    for (const node of this.graphState.nodes.filter(n => !n.isBlocked)) {
      const reachability = this.getDistressReachability(node.id);
      if (reachability) {
        distressReachability.push(reachability);
        if (!reachability.isReachable) {
          unreachableDistressNodes.push(node.id);
        }
      }
    }

    let avgContinuity = 0;
    const entranceNodes = this.graphState.nodes.filter(n => n.type === 'entrance' && !n.isBlocked);
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
}
