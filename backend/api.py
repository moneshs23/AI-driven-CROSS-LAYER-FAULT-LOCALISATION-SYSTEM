import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Initialize FastAPI app
app = FastAPI()

# Enable CORS for local development without proxy (optional but good idea)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# We define the request model expected by the frontend
class TelemetryData(BaseModel):
    sector: str
    lat: float
    loss: float
    jitter: float
    opt: float
    crc: int
    status: int
    cpu: float
    snmp: int
    hop: int

# Re-implement backend prediction logic or import it safely
# We will just duplicate the fast logic from backend.py to avoid 
# triggering the PyTorch training loop on every import if we can't avoid it.
THRESHOLDS = {
    "Industries": {"Latency": {"Normal": 40, "Warning": 80}, "Packet Loss": {"Normal": 1, "Warning": 3}, "CPU Usage": {"Normal": 60, "Warning": 75}, "Optical Power": {"Normal": -23, "Warning": -26}},
    "Public": {"Latency": {"Normal": 60, "Warning": 120}, "Packet Loss": {"Normal": 2, "Warning": 8}, "CPU Usage": {"Normal": 65, "Warning": 80}, "Optical Power": {"Normal": -24, "Warning": -27}},
    "Household": {"Latency": {"Normal": 80, "Warning": 150}, "Packet Loss": {"Normal": 5, "Warning": 15}, "CPU Usage": {"Normal": 70, "Warning": 85}, "Optical Power": {"Normal": -25, "Warning": -28}}
}

segments = {2: "NOC Core Server", 3: "Aggregation Node", 4: "Block/GP Hub", 5: "OLT Hardware", 6: "ONT (User Edge)"}

ERROR_DATA = {
    "Healthy": {"Category": "None 🟢", "Type": "N/A (System Stable)"},
    "Fiber_Cut": {"Category": "Hardware Fault 🔴", "Type": "Hardware (Physical Layer)"},
    "OLT_Failure": {"Category": "Hardware Fault 🔴", "Type": "Hardware (Device Layer)"},
    "Congestion": {"Category": "Software Fault 🟠", "Type": "Software (Traffic Layer)"},
    "Transport_Failure_MPLS": {"Category": "Software Fault 🟠", "Type": "Software (Protocol Layer)"}
}

@app.post("/api/diagnose")
def diagnose(data: TelemetryData):
    print(f"Received data: {data}")
    sector = data.sector if data.sector in THRESHOLDS else "Industries"
    limits = THRESHOLDS[sector]
    location = segments.get(data.hop, "Access Segment")
    
    if data.loss > 90 or data.lat > 500: pred = "Fiber_Cut"
    elif data.opt < limits["Optical Power"]["Warning"]: pred = "OLT_Failure"
    elif data.cpu > limits["CPU Usage"]["Warning"]: pred = "Congestion"
    elif data.lat > limits["Latency"]["Warning"]: pred = "Transport_Failure_MPLS"
    else: pred = "Healthy"

    meta = ERROR_DATA.get(pred, ERROR_DATA["Healthy"])
    base_conf = 47.0
    deviation = (max(0, data.lat - limits["Latency"]["Normal"]) / 5) + (data.loss * 3)
    confidence = min(99.4, base_conf + deviation)

    # Return structure expected by mlEngine.ts
    return {
        "status": "success",
        "diagnosis": {
            "prediction_error": pred,
            "category": meta["Category"],
            "fault_type": meta["Type"],
            "ai_confidence_pct": round(confidence, 1),
            "isolated_node": location
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
