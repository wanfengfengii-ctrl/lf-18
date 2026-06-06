export type NodeType = 'entrance' | 'platform' | 'shaft' | 'anchor' | 'danger';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CaveNode {
  id: string;
  name: string;
  type: NodeType;
  description?: string;
  x: number;
  y: number;
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
  danger: { label: '危险区域', color: '#F44336', icon: 'warning' }
};

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
