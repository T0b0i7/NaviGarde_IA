import { useState, useEffect } from 'react';
import { Anchor, Shield, Database, Server, Activity } from 'lucide-react';
import { getHealth } from '../utils/api';

export default function Navbar() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await getHealth();
        setHealth(data);
      } catch (error) {
        console.error('Erreur santé:', error);
        setHealth({ status: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <Anchor className="h-8 w-8 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold">NaviGarde IA</h1>
              <p className="text-xs text-blue-300">Sécurité Maritime & Portuaire - Bénin</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <Server className={`h-4 w-4 ${health?.status === 'ok' ? 'text-green-400' : 'text-red-400'}`} />
                <span>Backend: {loading ? '...' : health?.status === 'ok' ? 'OK' : 'ERREUR'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className={`h-4 w-4 ${health?.db === 'ok' ? 'text-green-400' : 'text-yellow-400'}`} />
                <span>BDD: {loading ? '...' : health?.db === 'ok' ? 'OK' : health?.persistence || 'INCONNU'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-cyan-400" />
                <span className="text-cyan-400 font-semibold">L'IA propose, l'humain décide</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-green-400" />
              <span className="text-sm">En ligne</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
