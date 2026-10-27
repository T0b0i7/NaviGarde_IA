import { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  Bell,
  User,
  Activity,
  PieChart,
  AlertTriangle,
  FileText,
  ChevronRight,
  MapPin,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Données (calquées sur la maquette fournie)                                 */
/* -------------------------------------------------------------------------- */

const statCards = [
  {
    id: 'inspections',
    title: 'Inspections du jour',
    value: '18',
    trend: 12,
    yesterday: 16,
    icon: <LayoutDashboard className="h-5 w-5" />,
    bgClass: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'alerts',
    title: 'Alertes ouvertes',
    value: '5',
    trend: 2,
    yesterday: 3,
    icon: <Bell className="h-5 w-5" />,
    bgClass: 'bg-red-100 text-red-600',
    trendDown: false,
  },
  {
    id: 'reports',
    title: 'Rapports en attente',
    value: '7',
    trend: 1,
    yesterday: 6,
    icon: <FileText className="h-5 w-5" />,
    bgClass: 'bg-amber-100 text-amber-600',
    trendDown: true,
  },
  {
    id: 'vessels',
    title: 'Embarcations suivies',
    value: '42',
    trend: 5,
    yesterday: 39,
    icon: <Smartphone className="h-5 w-5" />,
    bgClass: 'bg-purple-100 text-purple-600',
  },
];

const lineChartData = [
  { date: '23/10', confirmees: 12, enCours: 6, rejetees: 4 },
  { date: '24/10', confirmees: 20, enCours: 8, rejetees: 5 },
  { date: '25/10', confirmees: 24, enCours: 10, rejetees: 7 },
  { date: '26/10', confirmees: 15, enCours: 9, rejetees: 6 },
  { date: '27/10', confirmees: 20, enCours: 11, rejetees: 4 },
  { date: '28/10', confirmees: 18, enCours: 9, rejetees: 6 },
  { date: '29/10', confirmees: 30, enCours: 16, rejetees: 8 },
];

const riskData = [
  { label: 'Faible', percent: '52%', color: '#10b981' },
  { label: 'Moyen', percent: '24%', color: '#f59e0b' },
  { label: 'Élevé', percent: '17%', color: '#f97316' },
  { label: 'Critique', percent: '7%', color: '#ef4444' },
];

const urgentAlerts = [
  {
    title: 'Alerte de détresse – Pirogue N°BK-0421',
    subtitle: 'Il y a 12 min - Zone de Cotonou',
    icon: <ShieldAlert className="h-5 w-5" />,
    iconBg: 'bg-red-100',
  },
  {
    title: 'Panne moteur – Vedette N°BN-1187',
    subtitle: 'Il y a 28 min - Porto-Novo',
    icon: <AlertTriangle className="h-5 w-5" />,
    iconBg: 'bg-amber-100',
  },
  {
    title: 'Problème météo – Pirogue N°BK-0765',
    subtitle: 'Il y a 45 min - Ouidah',
    icon: <AlertTriangle className="h-5 w-5" />,
    iconBg: 'bg-amber-100',
  },
];

const recentInspections = {
  headers: ['Date / Heure', 'Embarcation', 'Type', 'Lieu', 'Risque', 'Statut', 'Agent'],
  rows: [
    {
      id: '1',
      cells: [
        { value: '29/10/2025 14:32' },
        { value: 'Pirogue N°BK-0421' },
        { value: 'Pirogue' },
        { value: 'Cotonou' },
        { value: 'Élevé', riskClass: 'bg-red-100 text-red-800 border-red-200' },
        { value: 'En cours', statusClass: 'bg-blue-100 text-blue-800 border-blue-200' },
        { value: 'Adélaïde HOUNDE' },
      ],
    },
    {
      id: '2',
      cells: [
        { value: '29/10/2025 13:15' },
        { value: 'Vedette N°BN-1187' },
        { value: 'Vedette' },
        { value: 'Porto-Novo' },
        { value: 'Moyen', riskClass: 'bg-amber-100 text-amber-800 border-amber-200' },
        { value: 'Clôturée', statusClass: 'bg-green-100 text-green-800 border-green-200' },
        { value: 'Koffi DOSSA' },
      ],
    },
    {
      id: '3',
      cells: [
        { value: '29/10/2025 11:47' },
        { value: 'Barge N°BJ-2234' },
        { value: 'Barge' },
        { value: 'Sèmè-Kpodji' },
        { value: 'Faible', riskClass: 'bg-green-100 text-green-800 border-green-200' },
        { value: 'Clôturée', statusClass: 'bg-green-100 text-green-800 border-green-200' },
        { value: 'Marcel ATCHADE' },
      ],
    },
    {
      id: '4',
      cells: [
        { value: '29/10/2025 10:22' },
        { value: 'Pirogue N°BK-0765' },
        { value: 'Pirogue' },
        { value: 'Ouidah' },
        { value: 'Moyen', riskClass: 'bg-amber-100 text-amber-800 border-amber-200' },
        { value: 'En cours', statusClass: 'bg-blue-100 text-blue-800 border-blue-200' },
        { value: 'Adélaïde TOSSOU' },
      ],
    },
  ],
};

const quickActions = [
  {
    label: 'Nouvelle inspection',
    icon: <ShieldAlert className="h-5 w-5" />,
    bgClass: 'bg-blue-600 hover:bg-blue-700',
    iconBg: 'bg-blue-500/20',
  },
  {
    label: 'Centre d\'alertes',
    icon: <Bell className="h-5 w-5" />,
    bgClass: 'bg-red-600 hover:bg-red-700',
    iconBg: 'bg-red-500/20',
  },
  {
    label: 'Générer un rapport',
    icon: <FileText className="h-5 w-5" />,
    bgClass: 'bg-purple-600 hover:bg-purple-700',
    iconBg: 'bg-purple-500/20',
  },
];

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'inspections', label: 'Inspections', icon: <Activity className="h-5 w-5" /> },
  { id: 'alerts', label: 'Alertes', icon: <Bell className="h-5 w-5" />, badge: '5' },
  { id: 'reports', label: 'Rapports', icon: <FileText className="h-5 w-5" /> },
  { id: 'vessels', label: 'Embarcations', icon: <Smartphone className="h-5 w-5" /> },
  { id: 'bulletins', label: 'Bulletins maritimes', icon: <ShieldAlert className="h-5 w-5" /> },
  { id: 'users', label: 'Utilisateurs', icon: <User className="h-5 w-5" /> },
  { id: 'audit', label: 'Journal d\'audit', icon: <FileText className="h-5 w-5" /> },
  { id: 'settings', label: 'Paramètres', icon: <ShieldAlert className="h-5 w-5" /> },
];

/* -------------------------------------------------------------------------- */
/* Composant principal                                                        */
/* -------------------------------------------------------------------------- */

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('dashboard');

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* ---------- Sidebar ---------- */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col shrink-0">
        <div className="p-5 flex items-center space-x-3">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 3a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 0V5a2 2 0 10-4 0v12a2 2 0 104 0V5zM4 3a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V3zm0 0v12a2 2 0 104 0V3a2 2 0 10-4 0z"
              />
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight leading-tight">NaviGarde IA</div>
            <div className="text-xs text-blue-200 leading-tight">Sécurité maritime • Bénin</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeNav === item.id
                  ? 'bg-blue-700 text-blue-100 shadow-lg shadow-blue-600/40'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-800/50">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-blue-200 font-medium">En ligne</span>
          </div>
          <div className="text-[10px] text-blue-300/70 leading-relaxed">
            L'IA propose, l'humain décide.
          </div>
        </div>
      </aside>

      {/* ---------- Main content ---------- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-10">
          <div className="flex items-center space-x-4">
            <div className="relative w-72 md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une embarcation, une alerte, un rapport..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <button className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-colors">
              <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
              <Bell />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900">
                5
              </span>
            </button>
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Thomas ADJÉ</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Superviseur</p>
              </div>
              <img
                src="https://ui-avatars.com/api/?name=Thomas+ADJE&background=0f172a&color=fff"
                alt="Profile"
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Hero */}
          <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                Bonjour, Thomas ADJÉ !
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Voici un aperçu de l'activité de NaviGarde IA aujourd'hui.
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-1">
                <svg
                  className="h-3 w-3 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Mer 29 oct. 2025
              </div>
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                Cotonou - Bénin
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
            {statCards.map((card) => (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {card.value}
                    </p>
                    <div className="flex items-center mt-2 text-[10px]">
                      {card.trendDown ? (
                        <>
                          <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            ↓ {card.trend}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            ↑ {card.trend}%
                          </span>
                        </>
                      )}
                      <span className="ml-1 text-slate-400">Hier : {card.yesterday}</span>
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-xl ${card.bgClass}`}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Widgets row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Activity chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Activité des inspections
                </h3>
                <div className="flex space-x-2 text-[10px]">
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Confirmées
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> En cours
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Rejetées
                  </span>
                </div>
              </div>

              <div className="h-64 w-full relative">
                <svg className="w-full h-full" viewBox="0 0 900 340" preserveAspectRatio="none">
                  {/* Grille */}
                  {['40', '30', '20', '10', '0'].map((label, i) => (
                    <line
                      key={i}
                      x1="70"
                      y1={290 - i * 58}
                      x2="880"
                      y2={290 - i * 58}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                    />
                  ))}

                  {/* Lignes de tendance */}
                  <polyline
                    points={lineChartData.map((d, i) => `${70 + i * 115},${290 - d.confirmees * 7.25}`).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={3}
                  />
                  <polyline
                    points={lineChartData.map((d, i) => `${70 + i * 115},${290 - d.enCours * 7.25}`).join(' ')}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth={3}
                  />
                  <polyline
                    points={lineChartData.map((d, i) => `${70 + i * 115},${290 - d.rejetees * 7.25}`).join(' ')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={3}
                  />

                  {/* Points */}
                  {lineChartData.map((d, i) => {
                    const x = 70 + i * 115;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={290 - d.confirmees * 7.25} r="4" fill="#3b82f6" />
                        <circle cx={x} cy={290 - d.enCours * 7.25} r="4" fill="#14b8a6" />
                        <circle cx={x} cy={290 - d.rejetees * 7.25} r="4" fill="#f59e0b" />
                      </g>
                    );
                  })}

                  {/* Labels X */}
                  {lineChartData.map((d, i) => (
                    <text
                      key={i}
                      x={70 + i * 115}
                      y={315}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#9ca3af"
                    >
                      {d.date}
                    </text>
                  ))}

                  {/* Labels Y */}
                  {['40', '30', '20', '10', '0'].map((label, i) => (
                    <text
                      key={`y${i}`}
                      x="60"
                      y={293 - i * 58}
                      fontSize="10"
                      fill="#9ca3af"
                      textAnchor="end"
                    >
                      {label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            {/* Donut + légende */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5 flex items-center space-x-2">
                <PieChart className="h-4 w-4 text-red-500" />
                Répartition des risques
              </h3>

              <div className="flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 mx-auto">
                  <svg className="w-full h-full" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      stroke="#10b981"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="72.3 226.2"
                      strokeLinecap="round"
                      transform="rotate(-90 16 16)"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="33.5 226.2"
                      strokeLinecap="round"
                      transform="rotate(-90 16 16)"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      stroke="#f97316"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="23.6 226.2"
                      strokeLinecap="round"
                      transform="rotate(-90 16 16)"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      stroke="#ef4444"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="10.1 226.2"
                      strokeLinecap="round"
                      transform="rotate(-90 16 16)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">42</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">inspections</p>
                  </div>
                </div>

                <div className="w-full mt-4 space-y-1.5">
                  {riskData.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="text-slate-600 dark:text-slate-400">{r.label}</span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {r.percent}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alertes urgentes */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Alertes urgentes
                </h3>
                <a href="#" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Voir tout →
                </a>
              </div>
              <div className="relative">
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  3
                </span>
                <div className="space-y-2">
                  {urgentAlerts.map((alert, i) => (
                    <div key={i} className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className={`p-1 rounded ${alert.iconBg}`}>{alert.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                          {alert.title}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          {alert.subtitle}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ligne du bas : Tableau + Actions rapides */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inspections récentes */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Inspections récentes
                </h3>
                <a href="#" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Voir tout →
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {recentInspections.headers.map((h) => (
                        <th key={h} className="py-3 pl-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {recentInspections.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        {row.cells.map((cell, idx) => (
                          <td key={idx} className="py-3.5 pl-2 text-sm text-slate-700 dark:text-slate-300">
                            {idx === 4 ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cell.riskClass}`}>
                                {cell.value}
                              </span>
                            ) : idx === 5 ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cell.statusClass}`}>
                                {cell.value}
                              </span>
                            ) : (
                              cell.value
                            )}
                          </td>
                        ))}
                        <td className="py-3.5 pl-2">
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Accès rapide */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Accès rapide</h3>
              <div className="space-y-2.5">
                {quickActions.map((action, i) => (
                  <a key={i} href="#" className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-white font-medium transition-all ${
                    action.bgClass
                  }`}>
                    <div className={`p-1.5 rounded-md ${action.iconBg}`}>{action.icon}</div>
                    <span>{action.label}</span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-70" />
                  </a>
                ))}

                <div className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <p className="text-[10px] italic text-slate-500 dark:text-slate-400 leading-relaxed">
                    "Des mers plus sûres pour un avenir durable"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
