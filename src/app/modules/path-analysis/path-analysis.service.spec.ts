import { TestBed } from '@angular/core/testing';
import { PathAnalysisService } from './path-analysis.service';
import { GraphStateService } from '../../core/state/graph-state.service';
import { CaveNode, RopeSegment } from '../../shared/models';

describe('PathAnalysisService', () => {
  let service: PathAnalysisService;
  let graphState: GraphStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    graphState = TestBed.inject(GraphStateService);
    service = TestBed.inject(PathAnalysisService);
  });

  beforeEach(() => {
    graphState.setNodes([
      { id: 'entrance', name: '入口', type: 'entrance', x: 0, y: 0, maxLoad: 2000, isBlocked: false, supplies: [], commDevices: [] },
      { id: 'platform1', name: '平台1', type: 'platform', x: 100, y: 0, maxLoad: 1500, isBlocked: false, supplies: [], commDevices: [] },
      { id: 'anchor1', name: '锚点1', type: 'anchor', x: 200, y: 100, maxLoad: 3000, isBlocked: false, supplies: [], commDevices: [] },
      { id: 'anchor2', name: '锚点2', type: 'anchor', x: 300, y: 200, maxLoad: 2500, isBlocked: false, supplies: [], commDevices: [] },
      { id: 'danger1', name: '危险区1', type: 'danger', x: 400, y: 300, maxLoad: 1000, isBlocked: false, supplies: [], commDevices: [] }
    ]);

    graphState.setSegments([
      { id: 's1', sourceId: 'entrance', targetId: 'platform1', length: 15, slope: 0, maxLoad: 2000, riskLevel: 'low', traversalDirection: 'bidirectional', isBlocked: false, description: '' },
      { id: 's2', sourceId: 'platform1', targetId: 'anchor1', length: 20, slope: 30, maxLoad: 1500, riskLevel: 'medium', traversalDirection: 'bidirectional', isBlocked: false, description: '' },
      { id: 's3', sourceId: 'anchor1', targetId: 'anchor2', length: 25, slope: 45, maxLoad: 2000, riskLevel: 'low', traversalDirection: 'bidirectional', isBlocked: false, description: '' },
      { id: 's4', sourceId: 'anchor2', targetId: 'danger1', length: 30, slope: 60, maxLoad: 1500, riskLevel: 'high', traversalDirection: 'bidirectional', isBlocked: false, description: '' }
    ]);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('findPathsToEntrance', () => {
    it('should find path from entrance to itself', () => {
      const paths = service.findPathsToEntrance('entrance');
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].path).toContain('entrance');
    });

    it('should find path from platform1 to entrance', () => {
      const paths = service.findPathsToEntrance('platform1');
      expect(paths.length).toBeGreaterThan(0);
      const firstPath = paths[0];
      expect(firstPath.path[0]).toBe('platform1');
      expect(firstPath.path[firstPath.path.length - 1]).toBe('entrance');
    });

    it('should return empty array for disconnected node', () => {
      graphState.addNode({ id: 'isolated', name: '孤立节点', type: 'platform', x: 500, y: 500, maxLoad: 1000, isBlocked: false, supplies: [], commDevices: [] });
      const paths = service.findPathsToEntrance('isolated');
      expect(paths.length).toBe(0);
    });

    it('should calculate total length correctly', () => {
      const paths = service.findPathsToEntrance('platform1');
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].totalLength).toBe(15);
    });

    it('should calculate total risk correctly', () => {
      const paths = service.findPathsToEntrance('danger1');
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].totalRisk).toBeGreaterThan(0);
    });
  });

  describe('findSafestPath', () => {
    it('should find safest path between two nodes', () => {
      const path = service.findSafestPath('entrance', 'anchor1');
      expect(path).toBeTruthy();
      expect(path?.path[0]).toBe('entrance');
      expect(path?.path[path.path.length - 1]).toBe('anchor1');
    });

    it('should return null if no path exists', () => {
      graphState.addNode({ id: 'isolated', name: '孤立节点', type: 'platform', x: 500, y: 500, maxLoad: 1000, isBlocked: false, supplies: [], commDevices: [] });
      const path = service.findSafestPath('entrance', 'isolated');
      expect(path).toBeNull();
    });
  });

  describe('getDisconnectedNodes', () => {
    it('should return empty array when all nodes are connected', () => {
      const disconnected = service.getDisconnectedNodes();
      expect(disconnected.length).toBe(0);
    });

    it('should detect disconnected nodes', () => {
      graphState.addNode({ id: 'isolated', name: '孤立节点', type: 'platform', x: 500, y: 500, maxLoad: 1000, isBlocked: false, supplies: [], commDevices: [] });
      const disconnected = service.getDisconnectedNodes();
      expect(disconnected).toContain('isolated');
    });
  });

  describe('getAnchorLoads', () => {
    it('should calculate static anchor loads', () => {
      const loads = service.getAnchorLoads();
      expect(loads).toBeDefined();
      expect(loads.length).toBeGreaterThan(0);
    });

    it('should include anchor nodes', () => {
      const loads = service.getAnchorLoads();
      const anchorIds = loads.map(l => l.nodeId);
      expect(anchorIds).toContain('anchor1');
      expect(anchorIds).toContain('anchor2');
    });
  });

  describe('findKeyAnchors', () => {
    it('should find key anchors', () => {
      const keyAnchors = service.findKeyAnchors();
      expect(keyAnchors).toBeDefined();
    });
  });

  describe('findBottleneckSegments', () => {
    it('should find bottleneck segments', () => {
      const bottlenecks = service.findBottleneckSegments();
      expect(bottlenecks).toBeDefined();
    });
  });

  describe('checkSegmentOverload', () => {
    it('should check segment overload', () => {
      const result = service.checkSegmentOverload('anchor1', 'anchor2', 100);
      expect(result).toBeDefined();
      expect(result.overloadedAnchors).toBeDefined();
    });
  });

  describe('setTeamConfig', () => {
    it('should update team config', () => {
      const config = {
        members: [
          { id: 'm1', name: '队员1', weight: 70, role: 'leader' }
        ],
        passingOrder: ['m1'],
        safetyFactor: 1.5
      };
      service.setTeamConfig(config);
      expect(service.teamConfig.members.length).toBe(1);
    });
  });

  describe('simulation mode', () => {
    it('should set simulation mode', () => {
      service.setSimulationMode(true);
      expect(service.isSimulationMode).toBe(true);
      service.setSimulationMode(false);
      expect(service.isSimulationMode).toBe(false);
    });

    it('should set simulated removed nodes', () => {
      service.setSimulatedRemovedNodes(['anchor1']);
      expect(service.simulatedRemovedNodes).toContain('anchor1');
    });

    it('should set simulated removed segments', () => {
      service.setSimulatedRemovedSegments(['s2']);
      expect(service.simulatedRemovedSegments).toContain('s2');
    });
  });
});
