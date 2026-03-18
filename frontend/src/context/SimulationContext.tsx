import React, { createContext, useContext, useState, useCallback } from 'react';
import { SystemStatus } from '../types';

interface SimulationContextType {
  systemStatus: SystemStatus;
  setSystemStatus: (status: SystemStatus) => void;
}

const SimulationContext = createContext<SimulationContextType>({
  systemStatus: 'OPERATIONAL',
  setSystemStatus: () => {},
});

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('OPERATIONAL');

  const updateStatus = useCallback((status: SystemStatus) => {
    setSystemStatus(status);
  }, []);

  return (
    <SimulationContext.Provider value={{ systemStatus, setSystemStatus: updateStatus }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulationContext() {
  return useContext(SimulationContext);
}
