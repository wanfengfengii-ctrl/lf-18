import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CaveNode,
  RopeSegment,
  RiskLevel,
  RouteVersion,
  RouteComparison,
  TeamConfig,
  SupplyConsumptionRate,
  CommDevice
} from '../../shared/models';
import { GraphStateService } from '../../core/state/graph-state.service';
import { SupplyService } from '../supply/supply.service';
import { CommService } from '../comm/comm.service';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private routeVersions$ = new BehaviorSubject<RouteVersion[]>([]);
  private nextVersionId = 1;

  private riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  constructor(
    private graphState: GraphStateService,
    private supplyService: SupplyService,
    private commService: CommService
  ) {}

  get routeVersions(): RouteVersion[] {
    return this.routeVersions$.value;
  }

  getRouteVersions(): Observable<RouteVersion[]> {
    return this.routeVersions$.asObservable();
  }

  saveRouteVersion(name: string, description?: string): RouteVersion {
    const version: RouteVersion = {
      id: `version-${this.nextVersionId++}`,
      name,
      description,
      createdAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(this.graphState.nodes)),
      segments: JSON.parse(JSON.stringify(this.graphState.segments)),
      teamConfig: JSON.parse(JSON.stringify(this.supplyService.teamConfig)),
      consumptionRates: JSON.parse(JSON.stringify(this.supplyService.consumptionRates)),
      estimatedDurationHours: this.supplyService.estimatedDurationHours,
      commDevices: JSON.parse(JSON.stringify(this.commService.commDevices))
    };
    const versions = [...this.routeVersions, version];
    this.routeVersions$.next(versions);
    return version;
  }

  loadRouteVersion(versionId: string): void {
    const version = this.routeVersions.find(v => v.id === versionId);
    if (version) {
      (this.graphState as any)['nodes$'].next(JSON.parse(JSON.stringify(version.nodes)));
      (this.graphState as any)['segments$'].next(JSON.parse(JSON.stringify(version.segments)));
      this.supplyService.setTeamConfig(JSON.parse(JSON.stringify(version.teamConfig)));
      if (version.consumptionRates) {
        this.supplyService.setConsumptionRates(JSON.parse(JSON.stringify(version.consumptionRates)));
      }
      if (version.estimatedDurationHours !== undefined) {
        this.supplyService.setEstimatedDurationHours(version.estimatedDurationHours);
      }
      if (version.commDevices) {
        (this.commService as any)['commDevices$'].next(JSON.parse(JSON.stringify(version.commDevices)));
        const maxId = version.commDevices.reduce((max, d) => {
          const num = parseInt(d.id.replace('comm-', ''));
          return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        (this.commService as any)['nextCommDeviceId'] = maxId + 1;
      } else {
        (this.commService as any)['commDevices$'].next([]);
        (this.commService as any)['nextCommDeviceId'] = 1;
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
}
