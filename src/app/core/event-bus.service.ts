import { Injectable } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';

export interface NodeSelectedEvent {
  type: 'nodeSelected';
  nodeId: string;
}

export interface SegmentSelectedEvent {
  type: 'segmentSelected';
  segmentId: string;
}

export interface SupplyChangedEvent {
  type: 'supplyChanged';
  nodeId: string;
}

export interface CommDeviceChangedEvent {
  type: 'commDeviceChanged';
  deviceId: string;
}

export interface SimulationModeChangedEvent {
  type: 'simulationModeChanged';
  isSimulationMode: boolean;
}

export interface VersionChangedEvent {
  type: 'versionChanged';
  versionId: string;
}

export type AppEvent =
  | NodeSelectedEvent
  | SegmentSelectedEvent
  | SupplyChangedEvent
  | CommDeviceChangedEvent
  | SimulationModeChangedEvent
  | VersionChangedEvent;

type EventType = AppEvent['type'];

type EventOfType<T extends EventType> = Extract<AppEvent, { type: T }>;

@Injectable({
  providedIn: 'root'
})
export class EventBusService {
  private event$ = new Subject<AppEvent>();

  emit<T extends AppEvent>(event: T): void {
    this.event$.next(event);
  }

  on<T extends EventType>(type: T): Observable<EventOfType<T>> {
    return this.event$.pipe(
      filter((e): e is EventOfType<T> => e.type === type)
    );
  }

  off(): void {
    this.event$.complete();
  }
}
