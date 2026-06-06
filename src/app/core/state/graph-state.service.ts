import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CaveNode, RopeSegment } from '../../models/cave-graph.model';

@Injectable({
  providedIn: 'root'
})
export class GraphStateService {
  private nodes$ = new BehaviorSubject<CaveNode[]>([]);
  private segments$ = new BehaviorSubject<RopeSegment[]>([]);

  private nextNodeId = 1;
  private nextSegmentId = 1;

  get nodes(): CaveNode[] {
    return this.nodes$.value;
  }

  get segments(): RopeSegment[] {
    return this.segments$.value;
  }

  getNodes(): Observable<CaveNode[]> {
    return this.nodes$.asObservable();
  }

  getSegments(): Observable<RopeSegment[]> {
    return this.segments$.asObservable();
  }

  addNode(node: Omit<CaveNode, 'id'> & { id?: string }): CaveNode {
    const id = node.id || `node-${this.nextNodeId++}`;

    if (this.nodes.some(n => n.id === id)) {
      throw new Error(`节点编号 ${id} 已存在，不能重复`);
    }

    const newNode: CaveNode = {
      id,
      name: node.name,
      type: node.type,
      description: node.description,
      x: node.x,
      y: node.y,
      maxLoad: node.maxLoad,
      isBlocked: node.isBlocked || false,
      supplies: node.supplies ? [...node.supplies] : undefined
    };

    const updated = [...this.nodes, newNode];
    this.nodes$.next(updated);
    return newNode;
  }

  updateNode(id: string, updates: Partial<Omit<CaveNode, 'id'>>): CaveNode | null {
    const index = this.nodes.findIndex(n => n.id === id);
    if (index === -1) return null;

    const updated = [...this.nodes];
    updated[index] = { ...updated[index], ...updates };
    this.nodes$.next(updated);
    return updated[index];
  }

  deleteNode(id: string): void {
    const updatedNodes = this.nodes.filter(n => n.id !== id);
    const updatedSegments = this.segments.filter(
      s => s.sourceId !== id && s.targetId !== id
    );
    this.nodes$.next(updatedNodes);
    this.segments$.next(updatedSegments);
  }

  addSegment(segment: Omit<RopeSegment, 'id'> & { id?: string }): RopeSegment {
    if (segment.length <= 0) {
      throw new Error('绳段长度必须大于零');
    }
    if (segment.sourceId === segment.targetId) {
      throw new Error('绳段不能连接同一个节点');
    }
    if (!this.nodes.find(n => n.id === segment.sourceId)) {
      throw new Error('起点节点不存在');
    }
    if (!this.nodes.find(n => n.id === segment.targetId)) {
      throw new Error('终点节点不存在');
    }

    const id = segment.id || `seg-${this.nextSegmentId++}`;

    if (this.segments.some(s => s.id === id)) {
      throw new Error(`绳段编号 ${id} 已存在`);
    }

    const newSegment: RopeSegment = {
      id,
      sourceId: segment.sourceId,
      targetId: segment.targetId,
      length: segment.length,
      slope: segment.slope,
      maxLoad: segment.maxLoad,
      riskLevel: segment.riskLevel,
      description: segment.description,
      traversalDirection: segment.traversalDirection || 'bidirectional',
      isBlocked: segment.isBlocked || false
    };

    const updated = [...this.segments, newSegment];
    this.segments$.next(updated);
    return newSegment;
  }

  updateSegment(id: string, updates: Partial<Omit<RopeSegment, 'id'>>): RopeSegment | null {
    const index = this.segments.findIndex(s => s.id === id);
    if (index === -1) return null;

    if (updates.length !== undefined && updates.length <= 0) {
      throw new Error('绳段长度必须大于零');
    }

    const updated = [...this.segments];
    updated[index] = { ...updated[index], ...updates };
    this.segments$.next(updated);
    return updated[index];
  }

  deleteSegment(id: string): void {
    const updated = this.segments.filter(s => s.id !== id);
    this.segments$.next(updated);
  }

  getNodeById(id: string): CaveNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  getSegmentById(id: string): RopeSegment | undefined {
    return this.segments.find(s => s.id === id);
  }

  isNodeIdExists(id: string): boolean {
    return this.nodes.some(n => n.id === id);
  }
}
