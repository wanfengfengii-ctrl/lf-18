import type { CaveNode, RopeSegment } from './graph.base.model';
import type { TeamConfig } from './team.model';
import type { SupplyConsumptionRate } from './supply.model';
import type { CommDevice } from './comm.model';

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
  commDevices?: CommDevice[];
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
