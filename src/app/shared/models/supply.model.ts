import type { RiskLevel } from './graph.base.model';

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
