import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, Search, AlertTriangle, Layers, Network, Activity,
  Clock, Zap, Radio, ArrowDown, Cpu,
} from 'lucide-react';
import { diagnoseNodeWithML, MLTelemetryData, MLDiagnosisResult } from '../utils/mlEngine';
import { sendFaultReportEmail, FaultReportDetails } from '../utils/emailService';
import { buildMockHierarchyPathForLayer } from '../utils/hierarchyHelper';
import type { NodeType } from '../types';

// ---------- constants ----------
const SEGMENTS: NodeType[] = ['NOC', 'BLOCK', 'GP', 'OLT', 'ONT'];
const SECTORS = ['Household', 'Industries', 'Public'] as const;
const SIM_HIERARCHY: NodeType[] = ['NOC', 'BLOCK', 'GP', 'OLT', 'ONT'];

type ViewState = 'form' | 'detail' | 'path';

// ML Input field metadata
const TELEMETRY_FIELDS: { key: keyof Omit<MLTelemetryData, 'sector'>; label: string; placeholder: string; step: string }[] = [
  { key: 'lat', label: 'Latency (ms)', placeholder: '45.0', step: '0.1' },
  { key: 'loss', label: 'Packet Loss (%)', placeholder: '2.5', step: '0.1' },
  { key: 'jitter', label: 'Jitter (ms)', placeholder: '1.0', step: '0.1' },
  { key: 'opt', label: 'Optical Power (dBm)', placeholder: '-24.0', step: '0.1' },
  { key: 'crc', label: 'CRC Errors', placeholder: '10', step: '1' },
  { key: 'status', label: 'Status (0/1)', placeholder: '1', step: '1' },
  { key: 'cpu', label: 'CPU Usage (%)', placeholder: '65.0', step: '0.1' },
  { key: 'snmp', label: 'SNMP Traps', placeholder: '0', step: '1' },
  { key: 'hop', label: 'Hop Count', placeholder: '3', step: '1' },
];

export default function ManualEntryPage() {
  const navigate = useNavigate();

  // ---------- form state ----------
  const [segment, setSegment] = useState<NodeType>('OLT');
  const [sector, setSector] = useState<string>('Household');
  const [fields, setFields] = useState<Record<string, string>>({
    lat: '', loss: '', jitter: '', opt: '', crc: '', status: '', cpu: '', snmp: '', hop: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------- result state ----------
  const [view, setView] = useState<ViewState>('form');
  const [mlResult, setMlResult] = useState<MLDiagnosisResult | null>(null);
  const [submittedSegment, setSubmittedSegment] = useState<NodeType>('OLT');
  const [submittedSector, setSubmittedSector] = useState<string>('Household');
  const [submittedTime, setSubmittedTime] = useState<string>('');
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // ---------- handlers ----------
  const updateField = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const telemetry: MLTelemetryData = {
      sector,
      lat: parseFloat(fields.lat) || 0,
      loss: parseFloat(fields.loss) || 0,
      jitter: parseFloat(fields.jitter) || 0,
      opt: parseFloat(fields.opt) || 0,
      crc: parseInt(fields.crc) || 0,
      status: parseInt(fields.status) || 0,
      cpu: parseFloat(fields.cpu) || 0,
      snmp: parseInt(fields.snmp) || 0,
      hop: parseInt(fields.hop) || 0,
    };

    try {
      const result = await diagnoseNodeWithML(telemetry);
      setMlResult(result);
      setSubmittedSegment(segment);
      setSubmittedSector(sector);
      setSubmittedTime(new Date().toLocaleString());
      setFeedbackGiven(false);
      setView('detail');

      const severityStr = result.faultLabel.includes('HEALTHY') || result.faultLabel.includes('Healthy') ? 'HEALTHY' : 'CRITICAL';
      const emailReport: FaultReportDetails = {
        severity: severityStr,
        layer_type: segment,
        sector: sector,
        specific_error: result.category,
        fault_label: result.faultLabel,
        confidence: result.aiConfidence.toFixed(1),
        time: new Date().toLocaleString(),
      };
      sendFaultReportEmail(emailReport);
    } catch {
      setMlResult({
        faultLabel: 'UNKNOWN FAILURE (ML OFFLINE)',
        category: 'Unknown',
        aiConfidence: 0,
        isolatedNode: 'N/A',
      });
      setSubmittedSegment(segment);
      setSubmittedSector(sector);
      setSubmittedTime(new Date().toLocaleString());
      setView('detail');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = () => {
    setView('form');
    setFeedbackGiven(false);
  };

  const sectorIcon = (s: string) =>
    s === 'Household' ? '🏠' : s === 'Industries' ? '🏭' : '🏛';

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-[#e5e5e5] font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white neo-border-b border-black p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="bg-white neo-border neo-shadow-sm px-3 py-1.5 text-xs font-black uppercase neo-press-sm flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Dashboard
          </button>
          <div>
            <h1 className="text-4xl font-black uppercase leading-none">
              MANUAL <span className="text-cyan-500">ENTRY</span>
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest mt-1 bg-black text-white px-3 py-1 inline-block">
              ML DIAGNOSIS · MANUAL INPUT
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-6">
        <AnimatePresence mode="wait">

          {/* ===== FORM VIEW ===== */}
          {view === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <form onSubmit={handleSubmit}>
                {/* Dropdowns row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Segment dropdown */}
                  <div className="bg-white neo-border neo-shadow-sm p-4">
                    <label className="block text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">
                      Segment
                    </label>
                    <select
                      value={segment}
                      onChange={e => setSegment(e.target.value as NodeType)}
                      className="w-full bg-[#f0f0f0] neo-border p-3 text-sm font-bold uppercase cursor-pointer"
                    >
                      {SEGMENTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sector dropdown */}
                  <div className="bg-white neo-border neo-shadow-sm p-4">
                    <label className="block text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">
                      Sector
                    </label>
                    <select
                      value={sector}
                      onChange={e => setSector(e.target.value)}
                      className="w-full bg-[#f0f0f0] neo-border p-3 text-sm font-bold uppercase cursor-pointer"
                    >
                      {SECTORS.map(s => (
                        <option key={s} value={s}>{sectorIcon(s)} {s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Telemetry fields */}
                <div className="bg-white neo-border neo-shadow p-6 mb-6">
                  <h2 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                    <Cpu className="w-5 h-5" /> Telemetry Data
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {TELEMETRY_FIELDS.map(f => (
                      <div key={f.key}>
                        <label className="block text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">
                          {f.label}
                        </label>
                        <input
                          type="number"
                          step={f.step}
                          placeholder={f.placeholder}
                          value={fields[f.key]}
                          onChange={e => updateField(f.key, e.target.value)}
                          className="w-full bg-[#f0f0f0] neo-border p-3 text-sm font-bold font-mono placeholder:opacity-30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-black text-white py-5 text-xl font-black uppercase neo-press flex items-center justify-center gap-3 group disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ANALYZING TELEMETRY...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6 group-hover:scale-125 transition-transform" />
                      SUBMIT &amp; DIAGNOSE
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* ===== FAULT DETAIL VIEW ===== */}
          {view === 'detail' && mlResult && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="flex items-center mb-6">
                <button
                  onClick={handleBackToForm}
                  className="bg-white neo-border neo-shadow-sm px-4 py-2 font-black uppercase neo-press-sm flex items-center gap-2"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  Back
                </button>
              </div>

              <div className="bg-white neo-border neo-shadow p-8 relative">
                {/* AI Confidence badge */}
                <div className="absolute top-4 right-4 bg-black text-white px-4 py-2 neo-border">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">AI Confidence</p>
                  <p className="text-2xl font-black text-green-400">{mlResult.aiConfidence.toFixed(1)}%</p>
                </div>

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-red-500 p-3 neo-border">
                    <AlertTriangle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase">Fault Details</h2>
                    <p className="font-bold text-red-500 uppercase tracking-widest">
                      {mlResult.faultLabel.includes('HEALTHY') || mlResult.faultLabel.includes('Healthy') ? 'HEALTHY' : 'CRITICAL'} Severity
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <DetailItem label="Fault Layer" value={submittedSegment} icon={<Layers />} />
                  <DetailItem label="Specific Error" value={mlResult.category} icon={<Network />} />
                  <DetailItem label="Current Status" value="FAILED" icon={<Activity />} />
                  <DetailItem label="Detection Time" value={submittedTime} icon={<Clock />} />
                  <DetailItem label="Fault Type" value={mlResult.faultLabel} icon={<Zap />} />
                  {(submittedSegment === 'OLT' || submittedSegment === 'ONT') ? (
                    <DetailItem label="Sector" value={`${sectorIcon(submittedSector)} ${submittedSector}`} icon={<Radio />} />
                  ) : (
                    <DetailItem label="Segment Type" value={submittedSegment} icon={<Radio />} />
                  )}
                </div>

                {/* Feedback */}
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

                {/* Specify Node button */}
                <button
                  onClick={() => setView('path')}
                  className="w-full bg-black text-white py-6 text-2xl font-black uppercase neo-press flex items-center justify-center gap-4 group"
                >
                  <Search className="w-8 h-8 group-hover:scale-125 transition-transform" />
                  Specify Node
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== HIERARCHY PATH VIEW ===== */}
          {view === 'path' && mlResult && (
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
                <div className="w-10" />
              </div>

              <div className="flex flex-col items-center gap-0">
                {SIM_HIERARCHY.map((layer, index) => {
                  const isFaultLayer = layer === submittedSegment;
                  const faultLayerIndex = SIM_HIERARCHY.indexOf(submittedSegment);
                  const isHealthy = faultLayerIndex > index;
                  const isDownstream = faultLayerIndex < index;

                  const mockPath = buildMockHierarchyPathForLayer(submittedSegment);
                  const nodeAtLayer = mockPath[layer];

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
                          {nodeAtLayer ? nodeAtLayer.label : `${layer} Node`}
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
                  The failure originated at the <span className="underline">{submittedSegment}</span> layer.
                  Fault type: <span className="font-black">{mlResult.faultLabel}</span>.
                  {' '}All downstream segments are currently affected.
                </p>
              </div>

              <button
                onClick={handleBackToForm}
                className="w-full mt-6 bg-black text-white py-4 text-lg font-black uppercase neo-press flex items-center justify-center gap-3 group"
              >
                <Network className="w-6 h-6 group-hover:scale-110 transition-transform" />
                New Entry
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black px-4 py-2 flex justify-between items-center text-xs font-bold uppercase bg-white">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          ML Backend · Connected · Manual Mode
        </div>
        <div>Manual Diagnosis Tool</div>
      </footer>
    </div>
  );
}

// Detail item component (same as simulation page)
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
