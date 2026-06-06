export type NodeType = 'entrance' | 'platform' | 'shaft' | 'anchor' | 'danger' | 'supply';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TraversalDirection = 'bidirectional' | 'sourceToTarget' | 'targetToSource';
export type HighlightType = 'key-anchor' | 'bottleneck' | 'unreachable' | 'safe-route' | 'danger-zone' | 'supply-point' | 'supply-deficit' | 'emergency-route';
export type SupplyType = 'oxygen' | 'medicine' | 'lighting' | 'battery' | 'food';
export type SupplyPriority = 'critical' | 'high' | 'medium' | 'low';
export type SupplyAdequacyLevel = 'sufficient' | 'warning' | 'deficit' | 'critical';

export interface SupplyItem {
  type: SupplyType;
  quantity: number;
  unitWeight: number;
  expirationDate?: number;
  minSafetyStock: number;
  priority: SupplyPriority;
  notes?: string;
}

export interface NodeSupplyInventory {
  nodeId: string;
  supplies: SupplyItem[];
  lastUpdated?: number;
}

export interface SupplyConsumptionRate {
  type: SupplyType;
  perPersonPerHour: number;
}

export interface SupplyAdequacyItem {
  type: SupplyType;
  available: number;
  required: number;
  adequacy: number;
  level: SupplyAdequacyLevel;
  daysRemaining: number;
}

export interface NodeSupplyAssessment {
  nodeId: string;
  nodeName: string;
  totalSuppliesWeight: number;
  adequacyItems: SupplyAdequacyItem[];
  overallLevel: SupplyAdequacyLevel;
  nearestSupplyPoint?: string;
  distanceToSupply: number;
  reachableSupplyPoints: string[];
}

export interface SupplyPlacementRecommendation {
  nodeId: string;
  nodeName: string;
  score: number;
  reason: string;
  recommendedSupplies: { type: SupplyType; quantity: number }[];
  coverageNodes: string[];
}

export interface EmergencySupplyRoute {
  fromNodeId: string;
  toSupplyNodeId: string;
  path: string[];
  segments: string[];
  totalLength: number;
  maxRisk: RiskLevel;
  riskScore: number;
}

export interface SupplyAnalysis {
  totalSupplyNodes: number;
  totalSuppliesWeight: number;
  supplyAssessments: NodeSupplyAssessment[];
  deficitNodes: string[];
  criticalNodes: string[];
  placementRecommendations: SupplyPlacementRecommendation[];
  emergencyRoutes: EmergencySupplyRoute[];
  consumptionRates: SupplyConsumptionRate[];
  estimatedDurationHours: number;
}

export interface CaveNode {
  id: string;
  name: string;
  type: NodeType;
  description?: string;
  x: number;
  y: number;
  maxLoad?: number;
  isBlocked?: boolean;
  supplies?: SupplyItem[];
}

export interface RopeSegment {
  id: string;
  sourceId: string;
  targetId: string;
  length: number;
  slope: number;
  maxLoad: number;
  riskLevel: RiskLevel;
  description?: string;
  traversalDirection?: TraversalDirection;
  isBlocked?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  weight: number;
  equipmentWeight: number;
}

export interface TeamConfig {
  members: TeamMember[];
  passingOrder: string[];
  safetyFactor: number;
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

export interface PathResult {
  path: string[];
  totalLength: number;
  maxRisk: RiskLevel;
  riskScore: number;
  avgRisk: number;
  segments: string[];
}

export interface RouteVersion {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  nodes: CaveNode[];
  segments: RopeSegment[];
  teamConfig: TeamConfig;
  consumptionRates?: SupplyConsumptionRate[];
  estimatedDurationHours?: number;
}

export interface ChangedSegmentDetail {
  id: string;
  changes: string[];
}

export interface RouteComparison {
  versionA: RouteVersion;
  versionB: RouteVersion;
  addedNodes: string[];
  removedNodes: string[];
  addedSegments: string[];
  removedSegments: string[];
  changedSegments: string[];
  changedSegmentDetails: ChangedSegmentDetail[];
  totalLengthDiff: number;
  riskLevelDiff: string;
}

export interface SimulationResult {
  removedNodeIds: string[];
  removedSegmentIds: string[];
  previouslyReachable: string[];
  nowUnreachable: string[];
  stillReachable: string[];
  newOverloadedAnchors: string[];
  riskIncrease: number;
  affectedPaths: { nodeId: string; originalPathCount: number; newPathCount: number }[];
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
}

export interface NodeTypeInfo {
  label: string;
  color: string;
  icon: string;
}

export const NODE_TYPE_MAP: Record<NodeType, NodeTypeInfo> = {
  entrance: { label: '入口', color: '#4CAF50', icon: 'door_open' },
  platform: { label: '平台', color: '#2196F3', icon: 'landscape' },
  shaft: { label: '竖井', color: '#9C27B0', icon: 'arrow_downward' },
  anchor: { label: '锚点', color: '#FF9800', icon: 'anchor' },
  danger: { label: '危险区域', color: '#F44336', icon: 'warning' },
  supply: { label: '补给站', color: '#00BCD4', icon: 'inventory_2' }
};

export const SUPPLY_TYPE_MAP: Record<SupplyType, { label: string; icon: string; color: string; defaultUnitWeight: number; defaultMinStock: number; defaultPriority: SupplyPriority }> = {
  oxygen: { label: '氧气', icon: 'air', color: '#2196F3', defaultUnitWeight: 5, defaultMinStock: 2, defaultPriority: 'critical' },
  medicine: { label: '医药', icon: 'medical_services', color: '#F44336', defaultUnitWeight: 0.5, defaultMinStock: 5, defaultPriority: 'high' },
  lighting: { label: '照明', icon: 'lightbulb', color: '#FFEB3B', defaultUnitWeight: 0.3, defaultMinStock: 3, defaultPriority: 'high' },
  battery: { label: '电池', icon: 'battery_full', color: '#9C27B0', defaultUnitWeight: 0.8, defaultMinStock: 4, defaultPriority: 'medium' },
  food: { label: '食物', icon: 'restaurant', color: '#4CAF50', defaultUnitWeight: 0.5, defaultMinStock: 10, defaultPriority: 'medium' }
};

export const SUPPLY_PRIORITY_MAP: Record<SupplyPriority, { label: string; color: string }> = {
  critical: { label: '关键', color: '#F44336' },
  high: { label: '高', color: '#FF9800' },
  medium: { label: '中', color: '#FFEB3B' },
  low: { label: '低', color: '#4CAF50' }
};

export const SUPPLY_ADEQUACY_MAP: Record<SupplyAdequacyLevel, { label: string; color: string }> = {
  sufficient: { label: '充足', color: '#4CAF50' },
  warning: { label: '预警', color: '#FFEB3B' },
  deficit: { label: '不足', color: '#FF9800' },
  critical: { label: '严重不足', color: '#F44336' }
};

export const DEFAULT_CONSUMPTION_RATES: SupplyConsumptionRate[] = [
  { type: 'oxygen', perPersonPerHour: 0.5 },
  { type: 'medicine', perPersonPerHour: 0.02 },
  { type: 'lighting', perPersonPerHour: 0.1 },
  { type: 'battery', perPersonPerHour: 0.05 },
  { type: 'food', perPersonPerHour: 0.1 }
];

export const RISK_LEVEL_MAP: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: '低风险', color: '#4CAF50' },
  medium: { label: '中风险', color: '#FF9800' },
  high: { label: '高风险', color: '#FF5722' },
  critical: { label: '极高风险', color: '#F44336' }
};

export interface AnchorLoadInfo {
  nodeId: string;
  nodeName: string;
  totalLoad: number;
  maxLoad: number;
  isOverloaded: boolean;
  connectedSegments: string[];
}

export interface PathResult {
  path: string[];
  totalLength: number;
  maxRisk: RiskLevel;
}

export interface GraphAnalysis {
  totalLength: number;
  nodeCount: number;
  segmentCount: number;
  overloadedAnchors: AnchorLoadInfo[];
  disconnectedNodes: string[];
  entranceNodes: string[];
}
