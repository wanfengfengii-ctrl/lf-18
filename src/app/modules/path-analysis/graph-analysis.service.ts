import { Injectable } from '@angular/core';
import { combineLatest, Observable, map } from 'rxjs';
import {
  GraphAnalysis,
  AnchorLoadInfo,
  AnchorDynamicLoad,
  GraphHighlight,
  SupplyAnalysis,
  CommAnalysis,
  SimulationResult
} from '../../shared/models';
import { GraphStateService } from '../../core/state/graph-state.service';
import { PathAnalysisService } from './path-analysis.service';
import { GraphHighlightService } from '../graph-highlight/graph-highlight.service';
import { SupplyService } from '../supply/supply.service';
import { CommService } from '../comm/comm.service';
import { SimulationService } from '../simulation/simulation.service';

@Injectable({
  providedIn: 'root'
})
export class GraphAnalysisService {
  constructor(
    private graphState: GraphStateService,
    private pathAnalysis: PathAnalysisService,
    private graphHighlight: GraphHighlightService,
    private supplyService: SupplyService,
    private commService: CommService,
    private simulationService: SimulationService
  ) {}

  getAnalysis(): Observable<GraphAnalysis> {
    return combineLatest([
      this.graphState.getNodes(),
      this.graphState.getSegments(),
      this.pathAnalysis.getTeamConfig(),
      this.pathAnalysis.getSimulationMode(),
      this.supplyService.getConsumptionRates(),
      this.supplyService.getEstimatedDurationHours(),
      this.commService.getCommDevices()
    ]).pipe(
      map(() => {
        const simMode = this.pathAnalysis.isSimulationMode;
        const simRemovedNodes = this.pathAnalysis.simulatedRemovedNodes;
        const simRemovedSegments = this.pathAnalysis.simulatedRemovedSegments;
        const nodes = this.graphState.nodes;
        const segments = this.graphState.segments;

        const filteredNodes = nodes.filter(
          n => !n.isBlocked && !(simMode && simRemovedNodes.includes(n.id))
        );
        const filteredSegments = segments.filter(
          s => !s.isBlocked && !(simMode && simRemovedSegments.includes(s.id))
        );

        const totalLength = filteredSegments.reduce((sum, s) => sum + s.length, 0);
        const nodeCount = filteredNodes.length;
        const segmentCount = filteredSegments.length;

        const overloadedAnchors: AnchorLoadInfo[] = this.pathAnalysis
          .getAnchorLoads()
          .filter(a => a.isOverloaded);
        const disconnectedNodes: string[] = this.pathAnalysis.getDisconnectedNodes();
        const entranceNodes: string[] = filteredNodes
          .filter(n => n.type === 'entrance')
          .map(n => n.id);
        const dynamicAnchorLoads: AnchorDynamicLoad[] = this.pathAnalysis.getDynamicAnchorLoads();
        const highlights: GraphHighlight = this.graphHighlight.getGraphHighlights();
        const supplyAnalysis: SupplyAnalysis = this.supplyService.getSupplyAnalysis();
        const commAnalysis: CommAnalysis = this.commService.getCommAnalysis();

        let simulationResult: SimulationResult | undefined;
        if (simMode) {
          simulationResult = this.simulationService.runSimulation();
        }

        return {
          totalLength,
          nodeCount,
          segmentCount,
          overloadedAnchors,
          disconnectedNodes,
          entranceNodes,
          dynamicAnchorLoads,
          highlights,
          supplyAnalysis,
          commAnalysis,
          simulationResult
        };
      })
    );
  }
}
