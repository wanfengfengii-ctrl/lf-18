import type { RiskLevel, AnchorLoadInfo } from './graph.base.model';
import type { SupplyAnalysis } from './supply.model';
import type { CommAnalysis } from './comm.model';
import type { SimulationResult } from './simulation.model';

export interface PathResult {
  path: string[];
  totalLength: number;
  maxRisk: RiskLevel;
  riskScore: number;
  avgRisk: number;
  segments: string[];
}

export interface GraphHighlight {
  keyAnchors: string[];
  bottleneckSegments: string[];
  unreachableNodes: string[];
  safestPath: string[] | null;
  dangerZones: string[];
  supplyPoints: string[];
  supplyDeficitNodes: string[];
  supplyCriticalNodes: string[];
  recommendedSupplyPoints: string[];
  emergencySupplyRoutes: { segments: string[]; nodes: string[] }[];
  commRelayNodes: string[];
  commBeaconNodes: string[];
  commDistressNodes: string[];
  commBlindSpotNodes: string[];
  commWeakSignalSegments: string[];
  commRecommendedRelayNodes: string[];
  commDistressRoutes: { segments: string[]; nodes: string[] }[];
  commOfflineNodes: string[];
}

export interface AnchorDynamicLoad {
  nodeId: string;
  nodeName: string;
  staticLoad: number;
  dynamicLoad: number;
  maxLoad: number;
  utilization: number;
  isOverloaded: boolean;
  peakLoadMembers: string[];
}

export interface GraphAnalysis {
  totalLength: number;
  nodeCount: number;
  segmentCount: number;
  overloadedAnchors: AnchorLoadInfo[];
  disconnectedNodes: string[];
  entranceNodes: string[];
  dynamicAnchorLoads?: AnchorDynamicLoad[];
  highlights?: GraphHighlight;
  simulationResult?: SimulationResult | null;
  supplyAnalysis?: SupplyAnalysis;
  commAnalysis?: CommAnalysis;
}
