import { TopologyNode } from '../types';

export interface MLTelemetryData {
  sector: string;
  lat: number;
  loss: number;
  jitter: number;
  opt: number;
  crc: number;
  status: number;
  cpu: number;
  snmp: number;
  hop: number;
}

export interface MLDiagnosisResponse {
  prediction_error?: string;
  category?: string;
  fault_type?: string;
  ai_confidence_pct?: number;
  isolated_node?: string;
  diagnosis?: any;
  [key: string]: any;
}

/** The structured result we return to the frontend */
export interface MLDiagnosisResult {
  faultLabel: string;
  category: string;
  aiConfidence: number;
  isolatedNode: string;
}

/**
 * Generates somewhat realistic random telemetry data for a node to feed to the ML model.
 */
export function generateRandomTelemetry(node: TopologyNode): MLTelemetryData {
  // Use the node's assigned sector, or default to 'Industries' for GP/BLOCK/NOC
  const sector = node.sector || 'Industries';

  // Define targeted fault profiles to minimize "NONE" specific errors from ML
  const profiles = [
    {
      // Profile A: Optical Fault (Very low optical power, others relatively normal)
      lat: () => parseFloat((Math.random() * 50 + 20).toFixed(2)), // 20-70ms
      loss: () => parseFloat((Math.random() * 2 + 0.5).toFixed(2)), // 0.5-2.5%
      jitter: () => parseFloat((Math.random() * 10 + 1).toFixed(2)), // 1-11ms
      opt: () => parseFloat((-(Math.random() * 15 + 35)).toFixed(2)), // -35 to -50 dBm
      crc: () => Math.floor(Math.random() * 100) + 10, // 10-110
      cpu: () => parseFloat((Math.random() * 20 + 30).toFixed(2)), // 30-50%
    },
    {
      // Profile B: Network Congestion (High latency, high packet loss, high jitter)
      lat: () => parseFloat((Math.random() * 800 + 400).toFixed(2)), // 400-1200ms
      loss: () => parseFloat((Math.random() * 40 + 20).toFixed(2)), // 20-60%
      jitter: () => parseFloat((Math.random() * 100 + 50).toFixed(2)), // 50-150ms
      opt: () => parseFloat((-(Math.random() * 10 + 15)).toFixed(2)), // -15 to -25 dBm
      crc: () => Math.floor(Math.random() * 200) + 50, // 50-250
      cpu: () => parseFloat((Math.random() * 30 + 50).toFixed(2)), // 50-80%
    },
    {
      // Profile C: Hardware/Processing Error (High CPU, high CRC errors)
      lat: () => parseFloat((Math.random() * 100 + 40).toFixed(2)), // 40-140ms
      loss: () => parseFloat((Math.random() * 5 + 1).toFixed(2)), // 1-6%
      jitter: () => parseFloat((Math.random() * 20 + 5).toFixed(2)), // 5-25ms
      opt: () => parseFloat((-(Math.random() * 10 + 15)).toFixed(2)), // -15 to -25 dBm
      crc: () => Math.floor(Math.random() * 5000 + 1000), // 1000-6000
      cpu: () => parseFloat((Math.random() * 10 + 90).toFixed(2)), // 90-100%
    }
  ];

  // Randomly select one of the 3 fault profiles
  const profile = profiles[Math.floor(Math.random() * profiles.length)];

  // Generate values that look like a failing or degraded node
  return {
    sector,
    lat: profile.lat(),
    loss: profile.loss(),
    jitter: profile.jitter(),
    opt: profile.opt(),
    crc: profile.crc(),
    status: 1, // 1 for alert/down state
    cpu: profile.cpu(),
    snmp: Math.floor(Math.random() * 3) + 1, // 1 to 3 SNMP traps
    hop: Math.floor(Math.random() * 5) + 1, // 1 to 5 hops
  };
}

/**
 * Calls the FastAPI backend on the Mac with the generated telemetry data.
 * Falls back to a mock string if network fails.
 */
export async function diagnoseNodeWithML(telemetry: MLTelemetryData): Promise<MLDiagnosisResult> {
  const fallback: MLDiagnosisResult = {
    faultLabel: "UNKNOWN FAILURE (ML OFFLINE)",
    category: "Unknown",
    aiConfidence: 0,
    isolatedNode: "N/A",
  };

  try {
    const response = await fetch("/api/diagnose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(telemetry)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: MLDiagnosisResponse = await response.json();
    console.log("ML Backend Full Response:", result);

    // The backend returns { status: 'success', diagnosis: { prediction_error, category, ... } }
    if (result.diagnosis && typeof result.diagnosis === 'object') {
      const d = result.diagnosis as any;
      return {
        faultLabel: typeof d.prediction_error === 'string' ? d.prediction_error : (typeof d.fault_type === 'string' ? d.fault_type : 'ML Fault'),
        category: typeof d.category === 'string' ? d.category : 'Unknown',
        aiConfidence: typeof d.ai_confidence_pct === 'number' ? d.ai_confidence_pct : 0,
        isolatedNode: typeof d.isolated_node === 'string' ? d.isolated_node : 'N/A',
      };
    }

    // Root level fields
    return {
      faultLabel: typeof result.prediction_error === 'string' ? result.prediction_error : (typeof result.fault_type === 'string' ? result.fault_type : 'ML Fault'),
      category: typeof result.category === 'string' ? result.category : 'Unknown',
      aiConfidence: typeof result.ai_confidence_pct === 'number' ? result.ai_confidence_pct : 0,
      isolatedNode: typeof result.isolated_node === 'string' ? result.isolated_node : 'N/A',
    };

  } catch (error) {
    console.error("Failed to reach the ML backend:", error);
    return fallback;
  }
}
