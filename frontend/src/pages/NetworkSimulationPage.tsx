import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Zap,
  RotateCcw,
  Network,
  AlertTriangle,
  Activity,
  Radio,
  Cpu,
  Wifi,
  X,
  Clock,
  Layers,
  Search,
  ArrowDown
} from 'lucide-react';
import { TopologyNode, FaultScenario, NodeType, FAULT_LABELS } from '../types';
import {
  propagateFault,
  resetAllFaults,
  buildCascadeTiers,
  deriveSystemStatus
} from '../simulation/FaultPropagationEngine';
import { useSimulationContext } from '../context/SimulationContext';
import TopologyTree from '../components/TopologyTree';
import topologyData from '../data/networkTopology.json';
import { generateRandomTelemetry, diagnoseNodeWithML, MLDiagnosisResult } from '../utils/mlEngine';
import { sendFaultReportEmail, FaultReportDetails } from '../utils/emailService';
import { buildFullHierarchyPath } from '../utils/hierarchyHelper';

// Which fault types are applicable per node type
const FAULTS_FOR_NODE: Record<NodeType, { key: FaultScenario; label: string; icon: React.ReactNode; color: string }[]> = {
  NOC: [
    { key: 'NOC_FAILURE', label: 'NOC FAILURE', icon: <AlertTriangle className="w-4 h-4" />, color: '#dc2626' },
  ],
  BLOCK: [
    { key: 'AGGREGATION_BLOCK_FAILURE', label: 'BLOCK FAILURE', icon: <Network className="w-4 h-4" />, color: '#22d3ee' },
  ],
  GP: [
    { key: 'GP_CONGESTION', label: 'GP CONGESTION', icon: <Radio className="w-4 h-4" />, color: '#a78bfa' },
  ],
  OLT: [
    { key: 'FIBER_CUT', label: 'FIBER CUT', icon: <Wifi className="w-4 h-4" />, color: '#ef4444' },
    { key: 'OLT_HARDWARE_FAILURE', label: 'OLT HW FAILURE', icon: <Cpu className="w-4 h-4" />, color: '#f97316' },
  ],
  ONT: [
    { key: 'ONT_FAILURE', label: 'ONT FAILURE', icon: <Wifi className="w-4 h-4" />, color: '#737373' },
  ],
};

// The hierarchy layers for the path view
const SIM_HIERARCHY: NodeType[] = ['NOC', 'BLOCK', 'GP', 'OLT', 'ONT'];

const CASCADE_DELAY = 500;

interface PopupState {
  node: TopologyNode;
  x: number;
  y: number;
}

// Build the ancestry path from NOC to a given node
function buildNetworkPath(nodeId: string, nodeMap: Map<string, TopologyNode>): string {
  const path: string[] = [];
  let current = nodeMap.get(nodeId);
  while (current) {
    path.unshift(current.label);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return path.join(' → ');
}

// Determine severity from fault type
function getSeverity(node: TopologyNode): string {
  if (node.status === 'FAILED') return 'CRITICAL';
  if (node.status === 'DEGRADED') return 'MAJOR';
  return 'MINOR';
}

// Get error classification
function getErrorType(node: TopologyNode): string {
  const ft = node.faultType?.toLowerCase() || '';
  if (ft.includes('hardware') || ft.includes('fiber') || ft.includes('olt')) return 'HARDWARE';
  if (ft.includes('congestion') || ft.includes('packet')) return 'SOFTWARE';
  return 'HARDWARE';
}

export default function NetworkSimulationPage() {
  const [nodes, setNodes] = useState<TopologyNode[]>(topologyData.nodes as TopologyNode[]);
  const [isCascading, setIsCascading] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [isInjectingML, setIsInjectingML] = useState(false);
  const [simView, setSimView] = useState<'tree' | 'detail' | 'path'>('tree');
  const [selectedFaultNode, setSelectedFaultNode] = useState<TopologyNode | null>(null);
  const [rootCauseNodeIds, setRootCauseNodeIds] = useState<Set<string>>(new Set());
  const [mlMetadata, setMlMetadata] = useState<Record<string, MLDiagnosisResult>>({});
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const { setSystemStatus } = useSimulationContext();
  const cascadeTimers = useRef<number[]>([]);
  const pageRef = useRef<HTMLDivElement>(null);

  // Build node map
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, TopologyNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Update dashboard system status whenever nodes change
  useEffect(() => {
    const status = deriveSystemStatus(nodes);
    setSystemStatus(status);
  }, [nodes, setSystemStatus]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      cascadeTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Close popup if clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popup && !target.closest('[data-fault-popup]') && !target.closest('[data-node-id]')) {
        setPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popup]);

  const handleNodeClick = useCallback((node: TopologyNode, rect: DOMRect) => {
    if (isCascading) return;

    // Only handle active nodes for "Simulate Error" popup
    if (node.status !== 'ACTIVE') {
      setPopup(null);
      return;
    }

    const faults = FAULTS_FOR_NODE[node.nodeType];
    if (faults.length === 0) {
      setPopup(null);
      return;
    }

    const pageRect = pageRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    setPopup({
      node,
      x: rect.left - pageRect.left + rect.width / 2,
      y: rect.top - pageRect.top - 10,
    });
  }, [isCascading]);

  // Called from the ANALYSE ERROR button on faulted node cards
  const handleAnalyseError = useCallback((node: TopologyNode) => {
    setPopup(null);
    // Get latest node state from current nodes
    const latestNode = nodes.find(n => n.id === node.id) || node;
    const diagnosis = mlMetadata[latestNode.id];
    
    setSelectedFaultNode(latestNode);
    setSimView('detail');

    if (diagnosis) {
      // Send the automated email report when they view the details
      const severityStr = diagnosis.faultLabel.includes('HEALTHY') || diagnosis.faultLabel.includes('Healthy') ? 'HEALTHY' : 'CRITICAL';
      const emailReport: FaultReportDetails = {
        severity: severityStr,
        layer_type: latestNode.nodeType,
        sector: latestNode.sector,
        specific_error: diagnosis.category,
        fault_label: diagnosis.faultLabel,
        confidence: diagnosis.aiConfidence.toFixed(1),
        time: new Date().toLocaleString(),
      };
      
      // Fire and forget
      sendFaultReportEmail(emailReport).catch(console.error);
    }
  }, [nodes, mlMetadata]);

  const handleInjectFault = useCallback(async (targetNodeId: string, node: TopologyNode) => {
    if (isCascading || isInjectingML) return;
    
    setIsInjectingML(true);
    try {
      // 1. Generate fake telemetry data for the clicked node
      const telemetry = generateRandomTelemetry(node);
      
      // 2. Call the ML backend
      const mlResult = await diagnoseNodeWithML(telemetry);
      
      // Store the full ML metadata for this node
      setMlMetadata(prev => ({ ...prev, [targetNodeId]: mlResult }));
      
      setPopup(null);
      setRootCauseNodeIds(prev => new Set([...prev, targetNodeId]));

      const timestamp = new Date().toLocaleString();
      setIsCascading(true);

      // Pass the ML faultLabel string for propagation
      const finalNodes = propagateFault(nodes, targetNodeId, mlResult.faultLabel, timestamp);
      const tempMap = new Map<string, TopologyNode>();
      nodes.forEach(n => tempMap.set(n.id, n));
      const tiers = buildCascadeTiers(targetNodeId, tempMap);
      const finalMap = new Map<string, TopologyNode>();
      finalNodes.forEach(n => finalMap.set(n.id, n));

      tiers.forEach((tierIds, tierIndex) => {
        const timer = window.setTimeout(() => {
          setNodes(prev => {
            return prev.map(n => {
              if (tierIds.includes(n.id)) {
                const finalState = finalMap.get(n.id);
                return finalState || n;
              }
              return n;
            });
          });

          if (tierIndex === tiers.length - 1) {
            setIsCascading(false);
          }
        }, tierIndex * CASCADE_DELAY);

        cascadeTimers.current.push(timer);
      });

    } catch (err) {
      console.error(err);
    } finally {
      setIsInjectingML(false);
    }
  }, [nodes, isCascading, isInjectingML]);

  const handleReset = useCallback(() => {
    cascadeTimers.current.forEach(t => clearTimeout(t));
    cascadeTimers.current = [];
    setNodes(resetAllFaults(nodes));
    setIsCascading(false);
    setPopup(null);
    setSimView('tree');
    setSelectedFaultNode(null);
    setRootCauseNodeIds(new Set());
    setMlMetadata({});
  }, [nodes]);

  const handleBackToTree = useCallback(() => {
    setSimView('tree');
    setSelectedFaultNode(null);
    setFeedbackGiven(false);
  }, []);

  // Count stats
  const activeCount = nodes.filter(n => n.status === 'ACTIVE').length;
  const degradedCount = nodes.filter(n => n.status === 'DEGRADED').length;
  const failedCount = nodes.filter(n => n.status === 'FAILED').length;
  const sysStatus = deriveSystemStatus(nodes);

  return (
    <div ref={pageRef} className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto relative">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-white neo-border neo-shadow-sm px-4 py-2 font-black uppercase text-sm neo-press-sm mb-4"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            DASHBOARD
          </Link>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-2">
            NETWORK <span className="text-cyan-500">SIMULATION</span>
          </h1>
          <p className="text-lg font-bold bg-black text-white px-4 py-1 inline-block neo-shadow-sm">
            TANFINET ISP TOPOLOGY ·{' '}
            <span className={
              sysStatus === 'CRITICAL' ? 'text-red-400 animate-blink' :
              sysStatus === 'DEGRADED' ? 'text-yellow-400 animate-blink' :
              'text-green-400'
            }>
              {sysStatus}
            </span>
          </p>
        </div>

        {/* Stats + Reset */}
        <div className="flex gap-4 items-end">
          <div className="bg-white neo-border neo-shadow-sm p-3 flex items-center gap-3">
            <Activity className="w-6 h-6 text-green-500" />
            <div>
              <p className="text-[10px] font-black uppercase opacity-50">Active</p>
              <p className="text-xl font-black">{activeCount}</p>
            </div>
          </div>
          <div className="bg-yellow-300 neo-border neo-shadow-sm p-3 flex items-center gap-3">
            <Radio className="w-6 h-6 text-yellow-700" />
            <div>
              <p className="text-[10px] font-black uppercase opacity-50">Degraded</p>
              <p className="text-xl font-black">{degradedCount}</p>
            </div>
          </div>
          <div className="bg-red-500 neo-border neo-shadow-sm p-3 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-white" />
            <div>
              <p className="text-[10px] font-black uppercase opacity-50 text-white">Failed</p>
              <p className="text-xl font-black text-white">{failedCount}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="neo-border neo-shadow-sm neo-press-sm bg-black text-white p-3 flex items-center gap-2 font-black uppercase text-xs"
          >
            <RotateCcw className="w-5 h-5" />
            RESET
          </button>
        </div>
      </header>

      <main className="relative">
        <AnimatePresence mode="wait">

          {/* ===== TREE VIEW ===== */}
          {simView === 'tree' && (
            <motion.div
              key="tree"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Hint bar */}
              <div className="mb-6 bg-yellow-300 neo-border neo-shadow-sm px-5 py-3 flex items-center gap-3">
                <Zap className="w-5 h-5 text-black shrink-0" />
                <p className="text-sm font-black uppercase tracking-wide">
                  CLICK ANY NODE TO SIMULATE ERROR
                  {isCascading && (
                    <span className="ml-4 text-red-600 animate-blink">FAULT CASCADING...</span>
                  )}
                </p>
              </div>

              {/* Topology Tree Canvas */}
              <div className="bg-white neo-border neo-shadow p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-black p-2">
                      <Network className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight">TOPOLOGY TREE</h2>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-black uppercase">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500" /> ACTIVE
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-400" /> DEGRADED
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" /> FAILED
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-black pt-6">
                  <TopologyTree nodes={nodes} onNodeClick={handleNodeClick} onAnalyse={handleAnalyseError} faultRootIds={rootCauseNodeIds} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== FAULT DETAIL VIEW ===== */}
          {simView === 'detail' && selectedFaultNode && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="flex items-center mb-6">
                <button
                  onClick={handleBackToTree}
                  className="bg-white neo-border neo-shadow-sm px-4 py-2 font-black uppercase neo-press-sm flex items-center gap-2"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  Back
                </button>
              </div>

              <div className="bg-white neo-border neo-shadow p-8 relative">
                {/* AI Confidence badge in top-right */}
                {selectedFaultNode && mlMetadata[selectedFaultNode.id] && (
                  <div className="absolute top-4 right-4 bg-black text-white px-4 py-2 neo-border">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">AI Confidence</p>
                    <p className="text-2xl font-black text-green-400">{mlMetadata[selectedFaultNode.id].aiConfidence.toFixed(1)}%</p>
                  </div>
                )}
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-red-500 neo-border">
                    <AlertTriangle className="w-10 h-10 text-white animate-blink" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black uppercase leading-none">Fault Details</h2>
                    <p className="font-bold text-red-500 uppercase tracking-widest">
                      {getSeverity(selectedFaultNode)} Severity
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <DetailItem label="Fault Layer" value={selectedFaultNode.label} icon={<Layers />} />
                  <DetailItem label="Specific Error" value={mlMetadata[selectedFaultNode.id]?.category || selectedFaultNode.nodeType} icon={<Network />} />
                  <DetailItem label="Current Status" value={selectedFaultNode.status} icon={<Activity />} />
                  <DetailItem label="Detection Time" value={selectedFaultNode.timestamp || 'N/A'} icon={<Clock />} />
                  <DetailItem label="Fault Type" value={selectedFaultNode.faultType || 'N/A'} icon={<Zap />} />
                  {(selectedFaultNode.nodeType === 'OLT' || selectedFaultNode.nodeType === 'ONT') && selectedFaultNode.sector ? (
                    <DetailItem label="Sector" value={`${selectedFaultNode.sector === 'Household' ? '🏠' : selectedFaultNode.sector === 'Industries' ? '🏭' : '🏛'} ${selectedFaultNode.sector}`} icon={<Radio />} />
                  ) : (
                    <DetailItem label="Segment Type" value={selectedFaultNode.nodeType} icon={<Radio />} />
                  )}
                </div>

                {/* Satisfaction feedback box (dummy) — full width below the grid */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 opacity-30" />
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Feedback</p>
                  </div>
                  {!feedbackGiven ? (
                    <div className="neo-border p-4 bg-[#f8f8f8]">
                      <p className="text-sm font-bold uppercase mb-3">Satisfied with this diagnosis?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setFeedbackGiven(true)}
                          className="flex-1 bg-green-600 text-white py-2 text-xs font-black uppercase neo-border neo-press-sm hover:bg-green-700 transition-colors"
                        >YES</button>
                        <button
                          onClick={() => setFeedbackGiven(true)}
                          className="flex-1 bg-red-500 text-white py-2 text-xs font-black uppercase neo-border neo-press-sm hover:bg-red-600 transition-colors"
                        >NO</button>
                      </div>
                    </div>
                  ) : (
                    <div className="neo-border p-4 bg-green-50">
                      <p className="text-sm font-bold uppercase text-green-700">✓ Thank you for the response</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#f0f0f0] neo-border p-6 mb-8">
                  <p className="text-xs font-black uppercase opacity-50 mb-2">Network Path</p>
                  <p className="text-xl font-mono font-bold break-all">
                    {buildNetworkPath(selectedFaultNode.id, nodeMap)}
                  </p>
                </div>

                <button
                  onClick={() => setSimView('path')}
                  className="w-full bg-black text-white py-6 text-2xl font-black uppercase neo-press flex items-center justify-center gap-4 group"
                >
                  <Search className="w-8 h-8 group-hover:scale-125 transition-transform" />
                  Specify Node
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== HIERARCHY PATH VIEW ===== */}
          {simView === 'path' && selectedFaultNode && (
            <motion.div
              key="path"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => setSimView('detail')}
                  className="bg-white neo-border neo-shadow-sm px-4 py-2 font-black uppercase neo-press-sm flex items-center gap-2"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  Back
                </button>
                <h2 className="text-3xl font-black uppercase">Hierarchy View</h2>
                <div className="w-10" />
              </div>

              <div className="flex flex-col items-center gap-0">
                {SIM_HIERARCHY.map((layer, index) => {
                  const isFaultLayer = layer === selectedFaultNode.nodeType;
                  const faultLayerIndex = SIM_HIERARCHY.indexOf(selectedFaultNode.nodeType);
                  const isHealthy = faultLayerIndex > index;
                  const isDownstream = faultLayerIndex < index;

                  // Find the actual node on the path from NOC to the faulted node for this layer
                  const fullPath = buildFullHierarchyPath(selectedFaultNode.id, nodeMap);
                  const nodeForLayer = fullPath[layer];

                  return (
                    <div key={layer} className="flex flex-col items-center w-full">
                      <div
                        className={`
                          w-full max-w-xs p-6 neo-border text-center transition-all duration-500
                          ${isFaultLayer ? 'bg-red-500 text-white neo-shadow animate-fault-node scale-110 z-10' : ''}
                          ${isHealthy ? 'bg-green-400 text-black neo-shadow-sm' : ''}
                          ${isDownstream ? 'bg-white text-black/20 border-black/10' : ''}
                          ${!isFaultLayer && !isHealthy && !isDownstream ? 'bg-white text-black neo-shadow-sm' : ''}
                        `}
                      >
                        <p className="text-xs font-black uppercase opacity-60 mb-1">{layer}</p>
                        <p className="text-2xl font-black uppercase">
                          {isFaultLayer
                            ? selectedFaultNode.label
                            : isDownstream
                              ? `${layer} Node`
                              : nodeForLayer
                                ? nodeForLayer.label
                                : `${layer} Node`
                          }
                        </p>
                        {isFaultLayer && (
                          <div className="mt-2 pt-2 border-t border-white/30 text-sm font-bold">
                            FAULT DETECTED
                          </div>
                        )}
                      </div>

                      {index < SIM_HIERARCHY.length - 1 && (
                        <div className="h-12 w-1 bg-black relative">
                          <ArrowDown className="absolute -bottom-2 -left-[10px] w-6 h-6 text-black" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-12 p-6 bg-yellow-300 neo-border neo-shadow">
                <p className="font-black uppercase mb-2">Localization Result</p>
                <p className="font-bold">
                  The failure originated at the <span className="underline">{selectedFaultNode.nodeType}</span> layer
                  (<span className="font-black">{selectedFaultNode.label}</span>).
                  {selectedFaultNode.faultType && (
                    <> Fault type: <span className="font-black">{selectedFaultNode.faultType}</span>.</>
                  )}
                  {' '}All downstream segments are currently affected.
                </p>
              </div>

              <button
                onClick={handleBackToTree}
                className="w-full mt-6 bg-black text-white py-4 text-lg font-black uppercase neo-press flex items-center justify-center gap-3 group"
              >
                <Network className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Return to Topology
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Fault Popup (for active nodes — simulate error) */}
      <AnimatePresence>
        {popup && simView === 'tree' && (
          <motion.div
            data-fault-popup
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50"
            style={{
              left: popup.x,
              top: popup.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-white neo-border neo-shadow p-4 min-w-[220px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-black uppercase tracking-wider">SIMULATE ERROR</span>
                </div>
                <button
                  onClick={() => setPopup(null)}
                  className="p-1 hover:bg-black/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-[#f0f0f0] neo-border p-2 mb-3">
                <p className="text-[9px] font-black uppercase opacity-50">Target</p>
                <p className="text-sm font-black uppercase">{popup.node.label}</p>
                <p className="text-[9px] font-mono uppercase opacity-60">{popup.node.id}</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleInjectFault(popup.node.id, popup.node)}
                  disabled={isInjectingML}
                  className={`neo-border neo-press-sm p-3 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 text-white transition-all duration-200 ${isInjectingML ? 'bg-gray-500 cursor-not-allowed opacity-80' : 'bg-red-500 hover:translate-x-px hover:translate-y-px hover:bg-red-600'}`}
                >
                  {isInjectingML ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ANALYZING TELEMETRY...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      INJECT LIVE FAULT (ML)
                    </>
                  )}
                </button>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-black" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Footer Status Bar */}
      <footer className="mt-12 border-t-4 border-black pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${sysStatus === 'OPERATIONAL' ? 'bg-green-500 animate-pulse' : sysStatus === 'DEGRADED' ? 'bg-yellow-400 animate-blink' : 'bg-red-500 animate-blink'}`} />
          <span className="font-black uppercase text-sm tracking-widest">
            DASHBOARD SYNC: CONNECTED · SYSTEM STATUS: {sysStatus}
          </span>
        </div>
        <div className="font-mono font-bold text-sm">
          NODES: {nodes.length} · SIMULATION MODE
        </div>
      </footer>
    </div>
  );
}

// Helper: get the ancestry path from root to a node
function getAncestryPath(nodeId: string, nodeMap: Map<string, TopologyNode>): TopologyNode[] {
  const path: TopologyNode[] = [];
  let current = nodeMap.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return path;
}

// Detail item component (same as landing page)
function DetailItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-black opacity-40">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black uppercase opacity-50">{label}</p>
        <p className="text-xl font-black uppercase">{value}</p>
      </div>
    </div>
  );
}
