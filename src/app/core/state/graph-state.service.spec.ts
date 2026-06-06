import { TestBed } from '@angular/core/testing';
import { GraphStateService } from './graph-state.service';
import { CaveNode, RopeSegment } from '../../shared/models';

describe('GraphStateService', () => {
  let service: GraphStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GraphStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty nodes and segments', () => {
    service.getNodes().subscribe(nodes => {
      expect(nodes).toEqual([]);
    });
    service.getSegments().subscribe(segments => {
      expect(segments).toEqual([]);
    });
  });

  describe('addNode', () => {
    it('should add a node with generated id', () => {
      const node: Partial<CaveNode> = {
        name: '测试节点',
        type: 'platform',
        x: 100,
        y: 200
      };

      const result = service.addNode(node as CaveNode);
      expect(result.id).toBeTruthy();
      expect(result.name).toBe('测试节点');
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it('should use provided id if valid', () => {
      const node: CaveNode = {
        id: 'custom-id',
        name: '测试节点',
        type: 'platform',
        x: 100,
        y: 200,
        maxLoad: 1000,
        isBlocked: false,
        supplies: [],
        commDevices: []
      };

      const result = service.addNode(node);
      expect(result.id).toBe('custom-id');
    });
  });

  describe('updateNode', () => {
    it('should update node properties', () => {
      const node = service.addNode({
        id: 'n1',
        name: '原名称',
        type: 'platform',
        x: 0,
        y: 0
      } as CaveNode);

      service.updateNode(node.id, { name: '新名称', maxLoad: 2000 });

      service.getNodes().subscribe(nodes => {
        const updated = nodes.find(n => n.id === node.id);
        expect(updated?.name).toBe('新名称');
        expect(updated?.maxLoad).toBe(2000);
      });
    });
  });

  describe('deleteNode', () => {
    it('should delete node and associated segments', () => {
      const n1 = service.addNode({ id: 'n1', name: '节点1', type: 'platform', x: 0, y: 0 } as CaveNode);
      const n2 = service.addNode({ id: 'n2', name: '节点2', type: 'platform', x: 100, y: 100 } as CaveNode);
      const seg = service.addSegment({
        id: 's1',
        sourceId: 'n1',
        targetId: 'n2',
        length: 10,
        slope: 0,
        maxLoad: 1000
      } as RopeSegment);

      service.deleteNode('n1');

      service.getNodes().subscribe(nodes => {
        expect(nodes.length).toBe(1);
        expect(nodes[0].id).toBe('n2');
      });

      service.getSegments().subscribe(segments => {
        expect(segments.length).toBe(0);
      });
    });
  });

  describe('addSegment', () => {
    beforeEach(() => {
      service.addNode({ id: 'n1', name: '节点1', type: 'platform', x: 0, y: 0 } as CaveNode);
      service.addNode({ id: 'n2', name: '节点2', type: 'platform', x: 100, y: 100 } as CaveNode);
    });

    it('should add a segment between existing nodes', () => {
      const segment = service.addSegment({
        sourceId: 'n1',
        targetId: 'n2',
        length: 10,
        slope: 0,
        maxLoad: 500
      } as RopeSegment);

      expect(segment.id).toBeTruthy();
      expect(segment.sourceId).toBe('n1');
      expect(segment.targetId).toBe('n2');
    });

    it('should throw error if source node does not exist', () => {
      expect(() => {
        service.addSegment({
          sourceId: 'nonexistent',
          targetId: 'n2',
          length: 10,
          slope: 0,
          maxLoad: 500
        } as RopeSegment);
      }).toThrow();
    });

    it('should throw error if length is not positive', () => {
      expect(() => {
        service.addSegment({
          sourceId: 'n1',
          targetId: 'n2',
          length: 0,
          slope: 0,
          maxLoad: 500
        } as RopeSegment);
      }).toThrow();
    });
  });

  describe('setNodes and setSegments', () => {
    it('should replace all nodes', () => {
      const nodes: CaveNode[] = [
        { id: 'a1', name: 'A', type: 'entrance', x: 0, y: 0, maxLoad: 1000, isBlocked: false, supplies: [], commDevices: [] },
        { id: 'a2', name: 'B', type: 'anchor', x: 50, y: 50, maxLoad: 2000, isBlocked: false, supplies: [], commDevices: [] }
      ];

      service.setNodes(nodes);

      service.getNodes().subscribe(result => {
        expect(result.length).toBe(2);
        expect(result[0].id).toBe('a1');
      });
    });
  });

  describe('clearAll', () => {
    it('should clear all nodes and segments', () => {
      service.addNode({ id: 'n1', name: '节点1', type: 'platform', x: 0, y: 0 } as CaveNode);
      service.addNode({ id: 'n2', name: '节点2', type: 'platform', x: 100, y: 100 } as CaveNode);
      service.addSegment({
        id: 's1',
        sourceId: 'n1',
        targetId: 'n2',
        length: 10,
        slope: 0,
        maxLoad: 500
      } as RopeSegment);

      service.clearAll();

      service.getNodes().subscribe(nodes => expect(nodes.length).toBe(0));
      service.getSegments().subscribe(segments => expect(segments.length).toBe(0));
    });
  });
});
