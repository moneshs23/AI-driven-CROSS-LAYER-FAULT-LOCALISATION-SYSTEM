# AI-driven-CROSS-LAYER-FAULT-LOCALISATION-SYSTEM
Fault Detector is a modular, AI-driven monitoring ecosystem designed to automate and accelerate fault localization across multi-layer telecom networks. By leveraging a Temporal Fusion Transformer (TFT) and Large Language Models (LLMs), it transforms traditional manual troubleshooting into a real-time, actionable diagnostic process.
🚀 Key Features
Hierarchical Topology Traversal: Automatically isolates failing segments across NOC, BLOCK, GP, OLT, and ONT layers.
AI-Driven Anomaly Detection: Utilizes a TFT backend to analyze telemetry patterns and identify abnormal behavior in seconds.
LLM-Based Root Cause Analysis: Interprets telemetry and topology context to classify faults and recommend corrective actions.
Brutalist NOC Visualization: A React-based dashboard featuring cascading fault simulations, blinking nodes, and path isolation.
Automated Reporting: Generates structured JSON diagnostics delivered via dashboard panels and outage reports.
🏗️ Architecture
The system follows a modular data flow pipeline:
Network Topology → Telemetry Generation → AI Backend → Fault Diagnosis → NOC Visualization
Components
Frontend: React + TypeScript (Interactive topology & fault injection).
Simulation Engine: Generates realistic metrics (Latency, Packet Loss, Optical Power, CRC errors).
AI Backend: FastAPI + ML (TFT for anomalies) + LLM (Reasoning).
🛠️ Tech Stack
Frontend: React, TypeScript, Tailwind CSS
Backend: FastAPI, Python
Machine Learning: PyTorch/TensorFlow (Temporal Fusion Transformer)
AI: LLM Integration (for diagnostic explanation)
Data Handling: JSON-based structured reporting
🎯 Key Contributions
Precision: Automated identification of the exact failing network segment.
Explainability: Provides XAI (Explainable AI) diagnostics for network engineers.
Visualization: Real-time monitoring of hierarchical outages and cascading effects.
Scalability: Designed for large-scale telecom deployments.
🔮 Future Scope
Integration with live real-world telecom telemetry streams.
Cloud-scale distributed deployment.
Predictive maintenance and fault forecasting.
Full integration with existing ISP/NOC operational systems.
