import { useState } from 'react';
import Navbar from './components/Navbar';
import AgentTerminal from './components/AgentTerminal';
import Dashboard from './components/Dashboard';
import { Anchor, Terminal } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Petit header global minimal (le Dashboard a déjà son propre header interne) */}
      <div className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <Anchor className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="font-bold text-lg tracking-tight">NaviGarde IA</h1>
                <p className="text-xs text-blue-300">Sécurité Maritime & Portuaire - Bénin</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-blue-200">
              <span>L'IA propose, l'humain décide.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="border-b border-slate-200 dark:border-slate-800">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <Anchor className="h-4 w-4" />
                <span>Tableau de bord</span>
              </button>
              <button
                onClick={() => setActiveTab('terminal')}
                className={`${
                  activeTab === 'terminal'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <Terminal className="h-4 w-4" />
                <span>Terminal Agent</span>
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'terminal' && <AgentTerminal />}
      </div>

      <footer className="mt-12 py-6 bg-blue-900 text-white text-center">
        <p className="text-sm">NaviGarde IA - Hackathon Meta Global AI Developer 2026</p>
        <p className="text-xs text-blue-300 mt-1">L'IA propose, l'humain décide.</p>
      </footer>
    </div>
  );
}

export default App;
