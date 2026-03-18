import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import NetworkSimulationPage from './pages/NetworkSimulationPage.tsx';
import ManualEntryPage from './pages/ManualEntryPage.tsx';
import { SimulationProvider } from './context/SimulationContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SimulationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/network-simulation" element={<NetworkSimulationPage />} />
          <Route path="/manual" element={<ManualEntryPage />} />
        </Routes>
      </BrowserRouter>
    </SimulationProvider>
  </StrictMode>,
);
