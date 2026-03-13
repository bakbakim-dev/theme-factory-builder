import React from 'react';
import Dashboard from './components/Dashboard';
import { ConversionRecord } from './types';

export default function App() {
  const handleConversionComplete = (record: ConversionRecord, zipBlob: Blob) => {
    console.log('Conversion completed:', record);
    // You could store the record in local storage or state here
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>
      <div className="relative z-10">
        <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">TF</div>
              <span className="font-bold text-lg tracking-tight text-slate-100">Theme Factory</span>
            </div>
            <div className="flex gap-4 text-sm font-medium text-slate-400">
              <button className="hover:text-white transition-colors">Documentation</button>
              <button className="hover:text-white transition-colors">History</button>
            </div>
          </div>
        </nav>
        
        <main className="flex justify-center w-full">
          <Dashboard onConversionComplete={handleConversionComplete} />
        </main>

        <footer className="py-8 text-center text-slate-600 text-sm">
          <p>© {new Date().getFullYear()} Theme Factory AI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}