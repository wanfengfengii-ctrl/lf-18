export type CommDeviceType = 'relay' | 'beacon' | 'distress';
export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'none';
export type CommCoverageLevel = 'full' | 'partial' | 'weak' | 'none';

export interface CommDevice {
  id: string;
  nodeId: string;
  type: CommDeviceType;
  name: string;
  description?: string;
  coverageRadius: number;
  batteryLevel: number;
  batteryCapacity: number;
  signalStrength: number;
  isOnline: boolean;
  frequency?: string;
  lastCheckIn?: number;
}

export interface RelayStation extends CommDevice {
  type: 'relay';
  maxConnections: number;
  backhaulNodeId?: string;
  supportedChannels: number;
}

export interface PositioningBeacon extends CommDevice {
  type: 'beacon';
  positioningAccuracy: number;
  updateInterval: number;
  isActive: boolean;
}

export interface DistressPoint extends CommDevice {
  type: 'distress';
  alarmTriggered: boolean;
  lastAlarmTime?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface NodeCommCoverage {
  nodeId: string;
  nodeName: string;
  coverageLevel: CommCoverageLevel;
  signalQuality: SignalQuality;
  signalStrength: number;
  coveringDeviceIds: string[];
  distanceToNearestDevice: number;
}

export interface SegmentSignalInfo {
  segmentId: string;
  avgSignalStrength: number;
  minSignalStrength: number;
  signalQuality: SignalQuality;
  isWeakSignal: boolean;
  isBlindSpot: boolean;
  coveragePercent: number;
}

export interface RelayPlacementRecommendation {
  nodeId: string;
  nodeName: string;
  score: number;
  reason: string;
  estimatedCoverageGain: number;
  coveredNodes: string[];
  coveredSegments: string[];
  recommendedRadius: number;
}

export interface DistressReachableInfo {
  nodeId: string;
  nodeName: string;
  isReachable: boolean;
  nearestDistressId?: string;
  nearestDistressName?: string;
  distanceToDistress: number;
  pathToDistress?: string[];
  pathSegments?: string[];
  signalQuality: SignalQuality;
}

export interface PositioningContinuityResult {
  pathNodes: string[];
  pathSegments: string[];
  continuityPercent: number;
  gapSegments: string[];
  gapNodes: string[];
  hasContinuousCoverage: boolean;
  beaconCount: number;
}

export interface CommAnalysis {
  totalDevices: number;
  relayCount: number;
  beaconCount: number;
  distressCount: number;
  onlineCount: number;
  offlineCount: number;
  avgBatteryLevel: number;
  nodeCoverages: NodeCommCoverage[];
  segmentSignals: SegmentSignalInfo[];
  blindSpotNodes: string[];
  weakSignalSegments: string[];
  fullCoverageNodes: string[];
  relayRecommendations: RelayPlacementRecommendation[];
  distressReachability: DistressReachableInfo[];
  unreachableDistressNodes: string[];
  avgPositioningContinuity: number;
}

export const COMM_DEVICE_TYPE_MAP: Record<CommDeviceType, { label: string; color: string; icon: string; defaultRadius: number; defaultBattery: number; defaultSignal: number }> = {
  relay: { label: '中继台', color: '#2196F3', icon: 'settings_ethernet', defaultRadius: 80, defaultBattery: 100, defaultSignal: 85 },
  beacon: { label: '定位信标', color: '#9C27B0', icon: 'gps_fixed', defaultRadius: 50, defaultBattery: 80, defaultSignal: 75 },
  distress: { label: '求救点', color: '#F44336', icon: 'emergency', defaultRadius: 60, defaultBattery: 90, defaultSignal: 90 }
};

export const SIGNAL_QUALITY_MAP: Record<SignalQuality, { label: string; color: string; minStrength: number }> = {
  excellent: { label: '优秀', color: '#4CAF50', minStrength: 80 },
  good: { label: '良好', color: '#8BC34A', minStrength: 60 },
  fair: { label: '一般', color: '#FFEB3B', minStrength: 40 },
  poor: { label: '较差', color: '#FF9800', minStrength: 20 },
  none: { label: '无信号', color: '#F44336', minStrength: 0 }
};

export const COMM_COVERAGE_LEVEL_MAP: Record<CommCoverageLevel, { label: string; color: string }> = {
  full: { label: '完全覆盖', color: '#4CAF50' },
  partial: { label: '部分覆盖', color: '#FFEB3B' },
  weak: { label: '弱覆盖', color: '#FF9800' },
  none: { label: '盲区', color: '#F44336' }
};

export const DEFAULT_COMM_DEVICE_CONFIG = {
  relay: { maxConnections: 10, supportedChannels: 8 },
  beacon: { positioningAccuracy: 3, updateInterval: 5, isActive: true },
  distress: { hasAudio: true, hasVideo: false }
};
