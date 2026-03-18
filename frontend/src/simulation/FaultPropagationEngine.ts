import { TopologyNode, NodeStatus, FaultScenario } from "../types";

/**
 * TANFINET Fault Propagation Engine
 * Pure function: takes current topology state + fault config → returns updated nodes
 */

// Get all descendant IDs of a node (recursive)
function getDescendants(
  nodeId: string,
  nodeMap: Map<string, TopologyNode>,
): string[] {
  const node = nodeMap.get(nodeId);
  if (!node || node.children.length === 0) return [];

  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId);
    descendants.push(...getDescendants(childId, nodeMap));
  }
  return descendants;
}

// Get direct children IDs
function getDirectChildren(
  nodeId: string,
  nodeMap: Map<string, TopologyNode>,
): string[] {
  const node = nodeMap.get(nodeId);
  return node ? [...node.children] : [];
}

// Get children at a specific depth below a node
function getChildrenAtDepth(
  nodeId: string,
  depth: number,
  nodeMap: Map<string, TopologyNode>,
): string[] {
  if (depth === 0) return [nodeId];

  const node = nodeMap.get(nodeId);
  if (!node) return [];

  let currentLevel = [nodeId];
  for (let d = 0; d < depth; d++) {
    const nextLevel: string[] = [];
    for (const id of currentLevel) {
      const n = nodeMap.get(id);
      if (n) nextLevel.push(...n.children);
    }
    currentLevel = nextLevel;
  }
  return currentLevel;
}

// Build a tier-ordered cascade: returns array of arrays, each inner array is one tier
export function buildCascadeTiers(
  targetNodeId: string,
  nodeMap: Map<string, TopologyNode>,
): string[][] {
  const tiers: string[][] = [];
  let currentLevel = [targetNodeId];

  while (currentLevel.length > 0) {
    tiers.push([...currentLevel]);
    const nextLevel: string[] = [];
    for (const id of currentLevel) {
      const node = nodeMap.get(id);
      if (node) nextLevel.push(...node.children);
    }
    currentLevel = nextLevel;
  }

  return tiers;
}

// Main propagation function
export function propagateFault(
  nodes: TopologyNode[],
  targetNodeId: string,
  faultType: FaultScenario,
  timestamp: string,
): TopologyNode[] {
  const nodeMap = new Map<string, TopologyNode>();
  nodes.forEach((n) => nodeMap.set(n.id, { ...n }));

  const target = nodeMap.get(targetNodeId);
  if (!target) return nodes;

  switch (faultType) {
    case "NOC_FAILURE": {
      // NOC fails → everything fails
      const updated = nodes.map((n) => ({
        ...n,
        status: "FAILED" as NodeStatus,
        faultType: n.id === targetNodeId ? "NOC Failure" : "Cascade from NOC",
        timestamp,
      }));
      return updated;
    }

    case "AGGREGATION_BLOCK_FAILURE": {
      // Target block fails, GP under it DEGRADED, OLT DEGRADED, ONT DEGRADED (packet loss)
      const allDescendants = getDescendants(targetNodeId, nodeMap);

      return nodes.map((n) => {
        if (n.id === targetNodeId) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: "Aggregation Block Failure",
            timestamp,
          };
        }
        if (allDescendants.includes(n.id)) {
          return {
            ...n,
            status: "DEGRADED" as NodeStatus,
            faultType:
              n.nodeType === "ONT"
                ? "Packet Loss"
                : "Degraded from Block Failure",
            timestamp,
          };
        }
        return n;
      });
    }

    case "GP_CONGESTION": {
      // GP DEGRADED, OLT under it FAILED, ONT FAILED
      const allDescendants = getDescendants(targetNodeId, nodeMap);

      return nodes.map((n) => {
        if (n.id === targetNodeId) {
          return {
            ...n,
            status: "DEGRADED" as NodeStatus,
            faultType: "GP Congestion",
            timestamp,
          };
        }
        if (allDescendants.includes(n.id)) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: "Offline (GP Congestion)",
            timestamp,
          };
        }
        return n;
      });
    }

    case "FIBER_CUT": {
      // OLT fails, ONT under it fails
      const allDescendants = getDescendants(targetNodeId, nodeMap);

      return nodes.map((n) => {
        if (n.id === targetNodeId) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: "Fiber Cut",
            timestamp,
          };
        }
        if (allDescendants.includes(n.id)) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: "Offline (Fiber Cut)",
            timestamp,
          };
        }
        return n;
      });
    }

    case "OLT_HARDWARE_FAILURE": {
      // OLT fails, ONT under it fails
      const allDescendants = getDescendants(targetNodeId, nodeMap);

      return nodes.map((n) => {
        if (n.id === targetNodeId) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: "OLT Hardware Failure",
            timestamp,
          };
        }
        if (allDescendants.includes(n.id)) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: "Offline (OLT HW Failure)",
            timestamp,
          };
        }
        return n;
      });
    }

    default: {
      // Handle dynamic ML strings: root fails, downstream fails
      const allDescendants = getDescendants(targetNodeId, nodeMap);

      return nodes.map((n) => {
        if (n.id === targetNodeId) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: faultType,
            timestamp,
          };
        }
        if (allDescendants.includes(n.id)) {
          return {
            ...n,
            status: "FAILED" as NodeStatus,
            faultType: `Offline (${faultType})`,
            timestamp,
          };
        }
        return n;
      });
    }
  }
}

// Reset all nodes to ACTIVE
export function resetAllFaults(nodes: TopologyNode[]): TopologyNode[] {
  return nodes.map((n) => ({
    ...n,
    status: "ACTIVE" as NodeStatus,
    faultType: null,
    timestamp: null,
  }));
}

// Determine valid target nodes for a given fault scenario
export function getValidTargets(
  nodes: TopologyNode[],
  faultType: FaultScenario,
): TopologyNode[] {
  switch (faultType) {
    case "NOC_FAILURE":
      return nodes.filter((n) => n.nodeType === "NOC");
    case "AGGREGATION_BLOCK_FAILURE":
      return nodes.filter(
        (n) => n.nodeType === "BLOCK" && n.blockType === "AGGREGATE",
      );
    case "GP_CONGESTION":
      return nodes.filter((n) => n.nodeType === "GP");
    case "FIBER_CUT":
      return nodes.filter((n) => n.nodeType === "OLT");
    case "OLT_HARDWARE_FAILURE":
      return nodes.filter((n) => n.nodeType === "OLT");
    default:
      return [];
  }
}

// Derive system status from node states (for dashboard integration)
export function deriveSystemStatus(
  nodes: TopologyNode[],
): "OPERATIONAL" | "DEGRADED" | "CRITICAL" {
  const nocNode = nodes.find((n) => n.nodeType === "NOC");
  if (nocNode && nocNode.status === "FAILED") return "CRITICAL";

  const aggBlock = nodes.find(
    (n) => n.nodeType === "BLOCK" && n.blockType === "AGGREGATE",
  );
  if (
    aggBlock &&
    (aggBlock.status === "FAILED" || aggBlock.status === "DEGRADED")
  )
    return "DEGRADED";

  const hasAnyFault = nodes.some((n) => n.status !== "ACTIVE");
  if (hasAnyFault) return "DEGRADED";

  return "OPERATIONAL";
}
