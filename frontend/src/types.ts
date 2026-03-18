export type SegmentType = 'NOC' | 'Block' | 'GP' | 'OLT' | 'ONT';

export interface Fault {
  id: string;
  fault_layer: string;
  segment_type: SegmentType;
  path: string;
  status: string;
  error_type: 'Software' | 'Hardware' | 'None';
  detection_time: string;
  severity: 'Critical' | 'Major' | 'Minor';
  color: string;
}

export const NETWORK_HIERARCHY: SegmentType[] = ['NOC', 'Block', 'GP', 'OLT', 'ONT'];

// --- Network Simulation Types ---

export type NodeType = 'NOC' | 'BLOCK' | 'GP' | 'OLT' | 'ONT';
export type BlockType = 'AGGREGATE' | 'DISTRIBUTION' | null;
export type NodeStatus = 'ACTIVE' | 'DEGRADED' | 'FAILED';

export type FaultScenario = string;

export type SectorType = 'Household' | 'Industries' | 'Public';

export interface TopologyNode {
  id: string;
  label: string;
  nodeType: NodeType;
  blockType: BlockType;
  parentId: string | null;
  status: NodeStatus;
  faultType: string | null;
  timestamp: string | null;
  children: string[];
  sector?: SectorType | null;
}

export type SystemStatus = 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';

export const FAULT_LABELS: Record<FaultScenario, string> = {
  FIBER_CUT: 'FIBER CUT',
  OLT_HARDWARE_FAILURE: 'OLT HW FAILURE',
  GP_CONGESTION: 'GP CONGESTION',
  AGGREGATION_BLOCK_FAILURE: 'AGG BLOCK FAIL',
  NOC_FAILURE: 'NOC FAILURE',
};
