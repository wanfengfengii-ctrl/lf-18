import { Injectable } from '@angular/core';
import {
  GraphHighlight,
  PathResult
} from '../../shared/models';
import { GraphStateService } from '../../core/state/graph-state.service';
import { PathAnalysisService } from '../path-analysis/path-analysis.service';
import { SupplyService } from '../supply/supply.service';
import { CommService } from '../comm/comm.service';

@Injectable({
  providedIn: 'root'
})
export class GraphHighlightService {
  constructor(
    private graphState: GraphStateService,
    private pathAnalysis: PathAnalysisService,
    private supplyService: SupplyService,
    private commService: CommService
  ) {}

  getGraphHighlights(): GraphHighlight {
    const keyAnchors = this.pathAnalysis.findKeyAnchors();
    const bottleneckSegments = this.pathAnalysis.findBottleneckSegments();
    const unreachableNodes = this.pathAnalysis.getDisconnectedNodes();
    const dangerZones = this.graphState.nodes
      .filter(n => n.type === 'danger' && !n.isBlocked)
      .map(n => n.id);

    let safestPath: string[] | null = null;
    const nonDangerNodes = this.graphState.nodes.filter(
      n => n.type !== 'danger' && n.type !== 'entrance' && !n.isBlocked
    );
    if (nonDangerNodes.length > 0) {
      let bestPath: PathResult | null = null;
      for (const node of nonDangerNodes) {
        const path = this.pathAnalysis.findSafestPath(node.id);
        if (path && (!bestPath || path.riskScore < bestPath.riskScore)) {
          bestPath = path;
        }
      }
      safestPath = bestPath ? bestPath.path : null;
    }

    const supplyPoints = this.supplyService.getSupplyNodesWithSupplies().map(n => n.id);
    const supplyDeficitNodes = this.supplyService.getSupplyDeficitNodes();
    const supplyCriticalNodes = this.supplyService.getSupplyCriticalNodes();
    const recommendations = this.supplyService.recommendSupplyPlacements(3).map(r => r.nodeId);
    const emergencyRoutes = this.supplyService.calculateEmergencySupplyRoutes().map(r => ({
      segments: r.segments,
      nodes: r.path
    }));

    const commRelayNodes = this.commService.commDevices
      .filter(d => d.type === 'relay' && d.isOnline)
      .map(d => d.nodeId);
    const commBeaconNodes = this.commService.commDevices
      .filter(d => d.type === 'beacon' && d.isOnline)
      .map(d => d.nodeId);
    const commDistressNodes = this.commService.commDevices
      .filter(d => d.type === 'distress' && d.isOnline)
      .map(d => d.nodeId);
    const commOfflineNodes = this.commService.commDevices
      .filter(d => !d.isOnline)
      .map(d => d.nodeId);

    const commAnalysis = this.commService.getCommAnalysis();
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
}
