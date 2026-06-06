export interface TeamMember {
  id: string;
  name: string;
  weight: number;
  equipmentWeight: number;
}

export interface TeamConfig {
  members: TeamMember[];
  passingOrder: string[];
  safetyFactor: number;
}
