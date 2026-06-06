import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CaveNode,
  RopeSegment,
  TeamConfig,
  TeamMember,
  SupplyConsumptionRate,
  DEFAULT_CONSUMPTION_RATES,
  CommDevice,
  RelayStation,
  PositioningBeacon,
  DistressPoint,
  SupplyItem
} from '../../shared/models';
import { GraphStateService } from '../../core/state/graph-state.service';
import { SupplyService } from '../supply/supply.service';
import { CommService } from '../comm/comm.service';
import { SimulationService } from '../simulation/simulation.service';

@Injectable({
  providedIn: 'root'
})
export class GraphEditorService {
  private teamConfig$ = new BehaviorSubject<TeamConfig>({
    members: [],
    passingOrder: [],
    safetyFactor: 1.5
  });
  private nextMemberId = 1;

  constructor(
    private graphState: GraphStateService,
    private supplyService: SupplyService,
    private commService: CommService,
    private simulationService: SimulationService
  ) {}

  get teamConfig(): TeamConfig {
    return this.teamConfig$.value;
  }

  getTeamConfig(): Observable<TeamConfig> {
    return this.teamConfig$.asObservable();
  }

  setTeamConfig(config: TeamConfig): void {
    this.teamConfig$.next({ ...config });
    this.supplyService.setTeamConfig({ ...config });
  }

  addTeamMember(member: Omit<TeamMember, 'id'>): TeamMember {
    const id = `member-${this.nextMemberId++}`;
    const newMember: TeamMember = { id, ...member };
    const config = this.teamConfig;
    const newConfig = {
      ...config,
      members: [...config.members, newMember],
      passingOrder: [...config.passingOrder, id]
    };
    this.teamConfig$.next(newConfig);
    this.supplyService.setTeamConfig(newConfig);
    return newMember;
  }

  updateTeamMember(id: string, updates: Partial<TeamMember>): void {
    const config = this.teamConfig;
    const members = config.members.map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    const newConfig = { ...config, members };
    this.teamConfig$.next(newConfig);
    this.supplyService.setTeamConfig(newConfig);
  }

  removeTeamMember(id: string): void {
    const config = this.teamConfig;
    const newConfig = {
      ...config,
      members: config.members.filter(m => m.id !== id),
      passingOrder: config.passingOrder.filter(mid => mid !== id)
    };
    this.teamConfig$.next(newConfig);
    this.supplyService.setTeamConfig(newConfig);
  }

  setPassingOrder(order: string[]): void {
    const config = this.teamConfig;
    const newConfig = { ...config, passingOrder: order };
    this.teamConfig$.next(newConfig);
    this.supplyService.setTeamConfig(newConfig);
  }

  clearAll(): void {
    (this.graphState as any)['nodes$'].next([]);
    (this.graphState as any)['segments$'].next([]);
    (this.graphState as any)['nextNodeId'] = 1;
    (this.graphState as any)['nextSegmentId'] = 1;

    this.supplyService.setConsumptionRates(JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES)));
    this.supplyService.setEstimatedDurationHours(4);

    this.simulationService.exitSimulationMode();

    (this.commService as any)['commDevices$'].next([]);
    (this.commService as any)['nextCommDeviceId'] = 1;

    this.teamConfig$.next({
      members: [],
      passingOrder: [],
      safetyFactor: 1.5
    });
    this.nextMemberId = 1;
    this.supplyService.setTeamConfig({
      members: [],
      passingOrder: [],
      safetyFactor: 1.5
    });
  }

  loadSampleData(): void {
    this.clearAll();

    const sampleNodes: CaveNode[] = [
      { id: 'entrance-1', name: '主入口', type: 'entrance', x: 400, y: 100, description: '洞穴主入口' },
      { id: 'anchor-1', name: '入口锚点', type: 'anchor', x: 400, y: 180, description: '入口第一锚点', maxLoad: 350 },
      { id: 'platform-1', name: '第一平台', type: 'platform', x: 300, y: 280, description: '下降后第一平台' },
      { id: 'shaft-1', name: '一号竖井', type: 'shaft', x: 500, y: 350, description: '深约25米的竖井' },
      { id: 'anchor-2', name: '竖井锚点', type: 'anchor', x: 500, y: 280, description: '竖井顶部锚点', maxLoad: 500 },
      { id: 'platform-2', name: '地下大厅', type: 'platform', x: 500, y: 500, description: '宽阔的地下大厅' },
      { id: 'danger-1', name: '落石区', type: 'danger', x: 250, y: 400, description: '不稳定岩层区域' },
      { id: 'anchor-3', name: '分支锚点', type: 'anchor', x: 650, y: 450, description: '分支路线锚点', maxLoad: 300 },
      { id: 'platform-3', name: '东侧平台', type: 'platform', x: 750, y: 380, description: '东侧分支平台' },
      { id: 'anchor-4', name: '主通道锚点', type: 'anchor', x: 400, y: 420, description: '主通道关键锚点', maxLoad: 450 },
      { id: 'entrance-2', name: '紧急出口', type: 'entrance', x: 150, y: 350, description: '备用紧急出口' },
      {
        id: 'supply-1', name: '一号补给站', type: 'supply', x: 350, y: 220, description: '入口附近主要补给站',
        supplies: [
          { type: 'oxygen', quantity: 8, unitWeight: 5, minSafetyStock: 4, priority: 'critical' },
          { type: 'medicine', quantity: 15, unitWeight: 0.5, minSafetyStock: 10, priority: 'high' },
          { type: 'lighting', quantity: 12, unitWeight: 0.3, minSafetyStock: 6, priority: 'high' },
          { type: 'battery', quantity: 20, unitWeight: 0.8, minSafetyStock: 10, priority: 'medium' },
          { type: 'food', quantity: 30, unitWeight: 0.5, minSafetyStock: 15, priority: 'medium' }
        ] as SupplyItem[]
      },
      {
        id: 'supply-2', name: '二号补给站', type: 'supply', x: 570, y: 420, description: '地下深处备用补给站',
        supplies: [
          { type: 'oxygen', quantity: 5, unitWeight: 5, minSafetyStock: 3, priority: 'critical' },
          { type: 'medicine', quantity: 8, unitWeight: 0.5, minSafetyStock: 5, priority: 'high' },
          { type: 'lighting', quantity: 8, unitWeight: 0.3, minSafetyStock: 4, priority: 'high' },
          { type: 'battery', quantity: 12, unitWeight: 0.8, minSafetyStock: 6, priority: 'medium' },
          { type: 'food', quantity: 20, unitWeight: 0.5, minSafetyStock: 10, priority: 'medium' }
        ] as SupplyItem[]
      }
    ];

    const sampleSegments: RopeSegment[] = [
      { id: 'seg-1', sourceId: 'entrance-1', targetId: 'anchor-1', length: 15, slope: 45, maxLoad: 200, riskLevel: 'low', description: '入口下降绳' },
      { id: 'seg-2', sourceId: 'anchor-1', targetId: 'platform-1', length: 20, slope: 30, maxLoad: 200, riskLevel: 'low', description: '斜向下降' },
      { id: 'seg-3', sourceId: 'platform-1', targetId: 'anchor-2', length: 30, slope: 0, maxLoad: 150, riskLevel: 'medium', description: '水平横移' },
      { id: 'seg-4', sourceId: 'anchor-2', targetId: 'shaft-1', length: 25, slope: 90, maxLoad: 300, riskLevel: 'high', description: '竖井主绳' },
      { id: 'seg-5', sourceId: 'shaft-1', targetId: 'platform-2', length: 10, slope: 10, maxLoad: 200, riskLevel: 'low', description: '竖井底部' },
      { id: 'seg-6', sourceId: 'platform-2', targetId: 'anchor-3', length: 18, slope: 20, maxLoad: 180, riskLevel: 'medium', description: '分支路线' },
      { id: 'seg-7', sourceId: 'anchor-3', targetId: 'platform-3', length: 22, slope: 15, maxLoad: 200, riskLevel: 'low', description: '东侧分支' },
      { id: 'seg-8', sourceId: 'platform-1', targetId: 'danger-1', length: 12, slope: 5, maxLoad: 100, riskLevel: 'high', description: '通往落石区' },
      { id: 'seg-9', sourceId: 'anchor-1', targetId: 'anchor-4', length: 35, slope: 60, maxLoad: 250, riskLevel: 'medium', description: '主通道绳段', traversalDirection: 'bidirectional' },
      { id: 'seg-10', sourceId: 'anchor-4', targetId: 'platform-2', length: 20, slope: 35, maxLoad: 220, riskLevel: 'low', description: '主通道下段' },
      { id: 'seg-11', sourceId: 'platform-1', targetId: 'entrance-2', length: 25, slope: -20, maxLoad: 180, riskLevel: 'medium', description: '通往紧急出口' },
      { id: 'seg-12', sourceId: 'anchor-1', targetId: 'supply-1', length: 8, slope: 20, maxLoad: 150, riskLevel: 'low', description: '通往一号补给站' },
      { id: 'seg-13', sourceId: 'supply-1', targetId: 'platform-1', length: 12, slope: 25, maxLoad: 150, riskLevel: 'low', description: '补给站至第一平台' },
      { id: 'seg-14', sourceId: 'anchor-2', targetId: 'supply-2', length: 10, slope: 30, maxLoad: 150, riskLevel: 'low', description: '通往二号补给站' },
      { id: 'seg-15', sourceId: 'supply-2', targetId: 'platform-2', length: 15, slope: 40, maxLoad: 150, riskLevel: 'medium', description: '补给站至地下大厅' }
    ];

    (this.graphState as any)['nodes$'].next(sampleNodes);
    (this.graphState as any)['segments$'].next(sampleSegments);
    (this.graphState as any)['nextNodeId'] = 14;
    (this.graphState as any)['nextSegmentId'] = 16;

    const sampleTeamConfig: TeamConfig = {
      members: [
        { id: 'member-1', name: '队长-张伟', weight: 75, equipmentWeight: 15 },
        { id: 'member-2', name: '队员-李娜', weight: 60, equipmentWeight: 12 },
        { id: 'member-3', name: '队员-王强', weight: 80, equipmentWeight: 18 },
        { id: 'member-4', name: '队员-赵敏', weight: 55, equipmentWeight: 10 }
      ],
      passingOrder: ['member-1', 'member-2', 'member-3', 'member-4'],
      safetyFactor: 1.5
    };
    this.teamConfig$.next(sampleTeamConfig);
    this.supplyService.setTeamConfig(sampleTeamConfig);
    this.nextMemberId = 5;

    this.supplyService.setConsumptionRates(JSON.parse(JSON.stringify(DEFAULT_CONSUMPTION_RATES)));
    this.supplyService.setEstimatedDurationHours(8);

    const sampleCommDevices: CommDevice[] = [
      {
        id: 'comm-1',
        nodeId: 'entrance-1',
        type: 'relay',
        name: '入口主中继',
        description: '洞穴入口主中继台，负责地面通信',
        coverageRadius: 100,
        batteryLevel: 100,
        batteryCapacity: 100,
        signalStrength: 95,
        isOnline: true,
        frequency: '433MHz',
        lastCheckIn: Date.now(),
        maxConnections: 20,
        supportedChannels: 16
      } as RelayStation,
      {
        id: 'comm-2',
        nodeId: 'platform-1',
        type: 'beacon',
        name: '一号平台信标',
        description: '第一平台定位信标',
        coverageRadius: 60,
        batteryLevel: 85,
        batteryCapacity: 100,
        signalStrength: 80,
        isOnline: true,
        frequency: '2.4GHz',
        lastCheckIn: Date.now(),
        positioningAccuracy: 2,
        updateInterval: 3,
        isActive: true
      } as PositioningBeacon,
      {
        id: 'comm-3',
        nodeId: 'platform-2',
        type: 'relay',
        name: '地下大厅中继',
        description: '地下大厅中继台，覆盖深处区域',
        coverageRadius: 90,
        batteryLevel: 70,
        batteryCapacity: 100,
        signalStrength: 88,
        isOnline: true,
        frequency: '433MHz',
        lastCheckIn: Date.now(),
        maxConnections: 15,
        supportedChannels: 12
      } as RelayStation,
      {
        id: 'comm-4',
        nodeId: 'platform-2',
        type: 'distress',
        name: '大厅求救点',
        description: '地下大厅紧急求救终端',
        coverageRadius: 70,
        batteryLevel: 95,
        batteryCapacity: 100,
        signalStrength: 92,
        isOnline: true,
        frequency: '应急频道',
        lastCheckIn: Date.now(),
        alarmTriggered: false,
        hasAudio: true,
        hasVideo: false
      } as DistressPoint,
      {
        id: 'comm-5',
        nodeId: 'anchor-4',
        type: 'beacon',
        name: '主通道信标',
        description: '主通道关键定位信标',
        coverageRadius: 50,
        batteryLevel: 60,
        batteryCapacity: 100,
        signalStrength: 75,
        isOnline: true,
        frequency: '2.4GHz',
        lastCheckIn: Date.now(),
        positioningAccuracy: 3,
        updateInterval: 5,
        isActive: true
      } as PositioningBeacon,
      {
        id: 'comm-6',
        nodeId: 'supply-1',
        type: 'distress',
        name: '一号补给站求救点',
        description: '入口附近求救终端',
        coverageRadius: 65,
        batteryLevel: 88,
        batteryCapacity: 100,
        signalStrength: 90,
        isOnline: false,
        frequency: '应急频道',
        lastCheckIn: Date.now() - 3600000,
        alarmTriggered: false,
        hasAudio: true,
        hasVideo: true
      } as DistressPoint
    ];

    (this.commService as any)['commDevices$'].next(sampleCommDevices);
    (this.commService as any)['nextCommDeviceId'] = 7;
  }
}
