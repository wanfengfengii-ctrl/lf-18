export interface SimulationResult {
  removedNodeIds: string[];
  removedSegmentIds: string[];
  previouslyReachable: string[];
  nowUnreachable: string[];
  stillReachable: string[];
  newOverloadedAnchors: string[];
  riskIncrease: number;
  affectedPaths: { nodeId: string; originalPathCount: number; newPathCount: number }[];
}
