import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Activity,
  ChevronRight,
  ArrowDown,
  X,
  Network,
  Clock,
  Layers,
  Search,
  RefreshCw,
  Radio
} from 'lucide-react';
import { Fault, SegmentType, NETWORK_HIERARCHY, NodeType } from './types';
import { useSimulationContext } from './context/SimulationContext';
import { buildMockHierarchyPathForLayer } from './utils/hierarchyHelper';

const MOCK_FAULTS: Fault[] = [
  {
    id: '1',
    fault_layer: 'Block 42',
    segment_type: 'Block',
    path: 'NOC → Block 42',
    status: 'Congestion',
    error_type: 'Software',
    detection_time: '2026-02-27 08:42:12',
    severity: 'Critical',
    color: '#facc15' // Yellow
  },
  {
    id: '2',
    fault_layer: 'Block 7',
    segment_type: 'Block',
    path: 'NOC → Block 7',
    status: 'OLT_Fail',
    error_type: 'Hardware',
    detection_time: '2026-02-27 08:45:00',
    severity: 'Critical',
    color: '#22d3ee' // Cyan
  },
  {
    id: '3',
    fault_layer: 'GP-Node-Alpha',
    segment_type: 'GP',
    path: 'NOC → Block 12 → GP-Node-Alpha',
    status: 'Fiber_Cut',
    error_type: 'Hardware',
    detection_time: '2026-02-27 08:40:30',
    severity: 'Major',
    color: '#f472b6' // Pink
  }
];

export default function App() {
  const [faults, setFaults] = useState<Fault[]>(MOCK_FAULTS);
  const [selectedFault, setSelectedFault] = useState<Fault | null>(null);
  const [view, setView] = useState<'dashboard' | 'detail' | 'path'>('dashboard');
  const { systemStatus } = useSimulationContext();

  const handleCardClick = (fault: Fault) => {
    setSelectedFault(fault);
    setView('detail');
  };

  const handleSpecifyNode = () => {
    setView('path');
  };

  const closePanel = () => {
    setView('dashboard');
    setSelectedFault(null);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      {view === 'dashboard' && (
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-2">
              FAULT <span className="text-red-500">DETECTOR</span>
            </h1>
            <p className="text-xl font-bold bg-black text-white px-4 py-1 inline-block neo-shadow-sm">
              SYSTEM STATUS:{' '}
              <span className={
                systemStatus === 'CRITICAL' ? 'text-red-400 animate-blink' :
                systemStatus === 'DEGRADED' ? 'text-yellow-400 animate-blink' :
                'text-green-400'
              }>
                {systemStatus}
              </span>
            </p>
          </div>
          <div className="flex gap-4 items-end">
            <Link
              to="/network-simulation"
              className="bg-cyan-400 neo-border neo-shadow-sm neo-press-sm p-4 flex items-center gap-3 group"
            >
              <Radio className="w-8 h-8 text-black group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-xs font-black uppercase opacity-50">Network</p>
                <p className="text-lg font-black uppercase">SIM</p>
              </div>
            </Link>
            <Link
              to="/manual"
              className="bg-white neo-border neo-shadow-sm p-4 flex items-center gap-3 group neo-press-sm cursor-pointer"
            >
              <Search className="w-8 h-8 text-black group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-xs font-black uppercase opacity-50">Manual</p>
                <p className="text-lg font-black uppercase">ENTRY</p>
              </div>
            </Link>
            <div className="bg-white neo-border neo-shadow-sm p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-blink" />
              <div>
                <p className="text-xs font-black uppercase opacity-50">Active Faults</p>
                <p className="text-2xl font-black">{faults.length}</p>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="relative">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {faults.map((fault) => (
                <button
                  key={fault.id}
                  onClick={() => handleCardClick(fault)}
                  className="group text-left w-full"
                >
                  <div
                    className="neo-border neo-shadow neo-press p-6 h-full flex flex-col"
                    style={{ backgroundColor: fault.color }}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest">
                        {fault.segment_type}
                      </div>
                      <div className="w-4 h-4 rounded-full bg-red-500 neo-border animate-blink shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                    </div>

                    <h3 className="text-3xl font-black mb-2 leading-tight uppercase">
                      {fault.fault_layer}
                    </h3>

                    <div className="mt-auto space-y-3">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Activity className="w-4 h-4" />
                        <span>{fault.status} - {fault.error_type}</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-xs opacity-70">
                        <Clock className="w-4 h-4" />
                        <span>{fault.detection_time}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t-2 border-black flex justify-between items-center group-hover:translate-x-1 transition-transform">
                      <span className="font-black uppercase text-sm">Inspect Fault</span>
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                </button>
              ))}

              {/* Empty state / placeholder card */}
              <div className="neo-border border-dashed border-black/20 p-6 flex flex-col items-center justify-center text-black/20 min-h-[300px]">
                <RefreshCw className="w-12 h-12 mb-4 animate-spin-slow" />
                <p className="font-black uppercase">Scanning Network...</p>
              </div>
            </motion.div>
          )}

          {view === 'detail' && selectedFault && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="flex items-center mb-6">
                <button
                  onClick={closePanel}
                  className="bg-white neo-border neo-shadow-sm px-4 py-2 font-black uppercase neo-press-sm flex items-center gap-2"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  Back
                </button>
              </div>

              <div className="bg-white neo-border neo-shadow p-8 relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-red-500 neo-border">
                    <AlertTriangle className="w-10 h-10 text-white animate-blink" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black uppercase leading-none">Fault Details</h2>
                    <p className="font-bold text-red-500 uppercase tracking-widest">Critical Severity</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <DetailItem label="Fault Layer" value={selectedFault.fault_layer} icon={<Layers />} />
                  <DetailItem label="Segment Type" value={selectedFault.segment_type} icon={<Network />} />
                  <DetailItem label="Current Status" value={selectedFault.status} icon={<Activity />} />
                  <DetailItem label="Error Type" value={selectedFault.error_type} icon={<AlertTriangle />} />
                  <DetailItem label="Detection Time" value={selectedFault.detection_time} icon={<Clock />} />
                </div>

                <div className="bg-[#f0f0f0] neo-border p-6 mb-8">
                  <p className="text-xs font-black uppercase opacity-50 mb-2">Network Path</p>
                  <p className="text-xl font-mono font-bold break-all">
                    {selectedFault.path}
                  </p>
                </div>

                <button
                  onClick={handleSpecifyNode}
                  className="w-full bg-black text-white py-6 text-2xl font-black uppercase neo-press flex items-center justify-center gap-4 group"
                >
                  <Search className="w-8 h-8 group-hover:scale-125 transition-transform" />
                  Specify Node
                </button>
              </div>
            </motion.div>
          )}

          {view === 'path' && selectedFault && (
            <motion.div
              key="path"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => setView('detail')}
                  className="bg-white neo-border neo-shadow-sm px-4 py-2 font-black uppercase neo-press-sm flex items-center gap-2"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  Back
                </button>
                <h2 className="text-3xl font-black uppercase">Hierarchy View</h2>
                <div className="w-10" /> {/* Spacer */}
              </div>

              <div className="flex flex-col items-center gap-0">
                {NETWORK_HIERARCHY.map((layer, index) => {
                  const isFaultLayer = layer === selectedFault.segment_type;
                  const isHealthy = NETWORK_HIERARCHY.indexOf(selectedFault.segment_type) > index;
                  const isDownstream = NETWORK_HIERARCHY.indexOf(selectedFault.segment_type) < index;

                  const mockPath = buildMockHierarchyPathForLayer(selectedFault.segment_type as NodeType);
                  const nodeAtLayer = mockPath[layer as NodeType];

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
                          {isDownstream ? `${layer} Node` : (nodeAtLayer ? nodeAtLayer.label : `${layer} Node`)}
                        </p>
                        {isFaultLayer && (
                          <div className="mt-2 pt-2 border-t border-white/30 text-sm font-bold">
                            FAULT DETECTED
                          </div>
                        )}
                      </div>

                      {index < NETWORK_HIERARCHY.length - 1 && (
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
                  The failure originated at the <span className="underline">{selectedFault.segment_type}</span> layer.
                  All downstream segments (GP, OLT, ONT) are currently unreachable.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
      <footer className="mt-20 border-t-4 border-black pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="font-black uppercase text-sm tracking-widest">Live Feed Active</span>
        </div>
        <div className="font-mono font-bold text-sm">
          OPERATOR: {process.env.USER_EMAIL || 'DHARNISH.M'} | SESSION: {new Date().toISOString().split('T')[0]}
        </div>
      </footer>
    </div>
  );
}

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
