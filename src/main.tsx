import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { createServices, initializeServices } from '@/services/container';
import { ServicesProvider } from '@/context/ServicesContext';
import { ToastProvider } from '@/context/ToastContext';
import { DialogsProvider } from '@/context/DialogsContext';
import { ScanFlowProvider } from '@/context/ScanFlowContext';
import { App } from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found.');
}
const root = createRoot(container);

function renderApp() {
  root.render(
    <StrictMode>
      {/* HashRouter keeps the app working on any static host and offline without server
          rewrite rules. */}
      <HashRouter>
        <ServicesProvider services={services}>
          <ToastProvider>
            <DialogsProvider>
              <ScanFlowProvider>
                <App />
              </ScanFlowProvider>
            </DialogsProvider>
          </ToastProvider>
        </ServicesProvider>
      </HashRouter>
    </StrictMode>
  );
}

const services = createServices();
// Seed the database, then render. Rendering proceeds even if seeding fails so the user
// sees a helpful error rather than a blank screen.
initializeServices(services).finally(renderApp);
