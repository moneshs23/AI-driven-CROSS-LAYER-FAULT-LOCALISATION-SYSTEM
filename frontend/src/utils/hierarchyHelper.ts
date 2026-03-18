import { TopologyNode, NodeType } from '../types';
import topologyData from '../data/networkTopology.json';

const ALL_NODES = topologyData.nodes as TopologyNode[];
const NODE_MAP = new Map<string, TopologyNode>();
ALL_NODES.forEach(n => NODE_MAP.set(n.id, n));

const SIM_HIERARCHY: NodeType[] = ['NOC', 'BLOCK', 'GP', 'OLT', 'ONT'];

/**
 * Builds a full 5-level path of nodes that pass through the specific node.
 * Uses parents for upstream, and the first child sequentially for downstream.
 */
export function buildFullHierarchyPath(nodeId: string, customNodeMap?: Map<string, TopologyNode>): Record<NodeType, TopologyNode | undefined> {
  const mapToUse = customNodeMap || NODE_MAP;
  const result = {} as Record<NodeType, TopologyNode | undefined>;
  
  const targetNode = mapToUse.get(nodeId);
  if (!targetNode) return result;

  // Walk up
  let current: TopologyNode | undefined = targetNode;
  while (current) {
    result[current.nodeType] = current;
    current = current.parentId ? mapToUse.get(current.parentId) : undefined;
  }

  // Walk down from the target node
  current = targetNode;
  while (current && current.children.length > 0) {
    const child = mapToUse.get(current.children[0]);
    if (child) {
      result[child.nodeType] = child;
      current = child;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Finds the first node of the given layer type and builds its full 5-level path.
 * Used for manual entries and dashboard where only a layer type is provided.
 */
export function buildMockHierarchyPathForLayer(layerType: string | NodeType): Record<NodeType, TopologyNode | undefined> {
  // Try to find a node by layer type. (App uses sometimes different labels, map it just in case)
  let searchType = layerType;
  if (layerType === 'AGGREGATION_BLOCK' || layerType === 'DISTRIBUTION_BLOCK' || layerType === 'BLOCK') searchType = 'BLOCK';
  
  const firstMatch = ALL_NODES.find(n => n.nodeType === searchType) || ALL_NODES.find(n => n.nodeType === 'NOC');
  
  if (!firstMatch) return {} as Record<NodeType, TopologyNode | undefined>;
  
  return buildFullHierarchyPath(firstMatch.id, NODE_MAP);
}
