import React, { useState } from 'react';
import AdminBackendPanel from './components/AdminBackendPanel';
import ClientPortal from './components/ClientPortal';
import Dashboard from './components/Dashboard';
import SaasCorePanel from './components/SaasCorePanel';
import { ConversionRecord } from './types';

export default function App() {
  const [operatorToolsOpen, setOperatorToolsOpen] = useState(false);

  const handleConversionComplete = (record: ConversionRecord, zipBlob: Blob) => {
    console.log('Conversion completed:', record, zipBlob);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <main className="w-full">
        <ClientPortal
          operatorToolsOpen={operatorToolsOpen}
          onOpenOperatorTools={() => setOperatorToolsOpen((isOpen) => !isOpen)}
        />

        <section className={`relative z-10 bg-slate-950 text-slate-200 transition-all ${operatorToolsOpen ? 'block' : 'hidden'}`}>
          <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20">
                  TF
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-100">Theme Factory Operator Tools</span>
              </div>
              <button
                type="button"
                onClick={() => setOperatorToolsOpen(false)}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:border-slate-400 hover:text-white"
              >
                Hide operator tools
              </button>
            </div>
          </nav>

          <div className="fixed inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
          <div className="relative z-10">
            <AdminBackendPanel />
            <SaasCorePanel />
            <div className="flex w-full justify-center">
              <Dashboard onConversionComplete={handleConversionComplete} />
            </div>
          </div>
        </section>

        <footer className="bg-slate-950 py-8 text-center text-sm text-slate-600">
          <p>© {new Date().getFullYear()} Theme Factory AI. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
