import { TestBed } from '@angular/core/testing';
import { EventBusService, EventType, AppEvent, NodeSelectedEvent, SegmentSelectedEvent } from './event-bus.service';
import { Subscription } from 'rxjs';

describe('EventBusService', () => {
  let service: EventBusService;
  let subscriptions: Subscription[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventBusService);
    subscriptions = [];
  });

  afterEach(() => {
    subscriptions.forEach(sub => sub.unsubscribe());
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit and receive NodeSelectedEvent', (done) => {
    const testEvent: NodeSelectedEvent = {
      type: 'nodeSelected',
      payload: { nodeId: 'test-node-1' }
    };

    const sub = service.on('nodeSelected').subscribe(event => {
      expect(event.type).toBe('nodeSelected');
      expect(event.payload.nodeId).toBe('test-node-1');
      done();
    });
    subscriptions.push(sub);

    service.emit(testEvent);
  });

  it('should emit and receive SegmentSelectedEvent', (done) => {
    const testEvent: SegmentSelectedEvent = {
      type: 'segmentSelected',
      payload: { segmentId: 'test-seg-1' }
    };

    const sub = service.on('segmentSelected').subscribe(event => {
      expect(event.type).toBe('segmentSelected');
      expect(event.payload.segmentId).toBe('test-seg-1');
      done();
    });
    subscriptions.push(sub);

    service.emit(testEvent);
  });

  it('should filter events by type', (done) => {
    let nodeEvents = 0;
    let segmentEvents = 0;

    const sub1 = service.on('nodeSelected').subscribe(() => {
      nodeEvents++;
    });
    const sub2 = service.on('segmentSelected').subscribe(() => {
      segmentEvents++;
    });
    subscriptions.push(sub1, sub2);

    service.emit({ type: 'nodeSelected', payload: { nodeId: 'n1' } } as NodeSelectedEvent);
    service.emit({ type: 'segmentSelected', payload: { segmentId: 's1' } } as SegmentSelectedEvent);
    service.emit({ type: 'nodeSelected', payload: { nodeId: 'n2' } } as NodeSelectedEvent);

    setTimeout(() => {
      expect(nodeEvents).toBe(2);
      expect(segmentEvents).toBe(1);
      done();
    }, 10);
  });

  it('should work with multiple subscribers', (done) => {
    let count1 = 0;
    let count2 = 0;

    const sub1 = service.on('nodeSelected').subscribe(() => count1++);
    const sub2 = service.on('nodeSelected').subscribe(() => count2++);
    subscriptions.push(sub1, sub2);

    service.emit({ type: 'nodeSelected', payload: { nodeId: 'n1' } } as NodeSelectedEvent);

    setTimeout(() => {
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      done();
    }, 10);
  });

  it('should not emit after unsubscription', (done) => {
    let count = 0;

    const sub = service.on('nodeSelected').subscribe(() => count++);
    subscriptions.push(sub);

    service.emit({ type: 'nodeSelected', payload: { nodeId: 'n1' } } as NodeSelectedEvent);

    setTimeout(() => {
      sub.unsubscribe();
      service.emit({ type: 'nodeSelected', payload: { nodeId: 'n2' } } as NodeSelectedEvent);

      setTimeout(() => {
        expect(count).toBe(1);
        done();
      }, 10);
    }, 10);
  });
});
