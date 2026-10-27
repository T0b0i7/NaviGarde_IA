import { useState } from 'react';
import Navbar from './components/Navbar';
import AgentTerminal from './components/AgentTerminal';
import CapitainerieDashboard from './components/CapitainerieDashboard';
import { Anchor, LayoutDashboard, Terminal } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('terminal');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('terminal')}
                className={`${
                  activeTab === 'terminal'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <Terminal className="h-4 w-4" />
                <span>Terminal Agent</span>
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Capitainerie</span>
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'terminal' && <AgentTerminal />}
        {activeTab === 'dashboard' && <CapitainerieDashboard />}
      </div>

      <footer className="mt-12 py-6 bg-blue-900 text-white text-center">
        <p className="text-sm">NaviGarde IA - Hackathon Meta Global AI Developer 2026</p>
        <p className="text-xs text-blue-300 mt-1">L'IA propose, l'humain décide</p>
      </footer>
    </div>
  );
}

export default App;
