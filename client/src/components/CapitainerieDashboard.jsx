import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  FileText, 
  Download, 
  Edit3, 
  CheckCircle, 
  Clock,
  Shield,
  Eye
} from 'lucide-react';
import { getAlerts, getReport, downloadReportPdf, validateReport, updateReportDraft } from '../utils/api';

export default function CapitainerieDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const alertsData = await getAlerts().catch(() => ({ alerts: [] }));
      setAlerts(alertsData.alerts || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (reportId) => {
    try {
      const response = await downloadReportPdf(reportId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `navigarde-rapport-${reportId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      alert('Erreur lors du téléchargement du PDF');
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      const data = await getReport(reportId);
      setSelectedReport(data.report);
      setEditContent(data.report.content);
    } catch (error) {
      console.error('Erreur lecture rapport:', error);
    }
  };

  const handleEditReport = async () => {
    if (!selectedReport) return;
    try {
      const data = await updateReportDraft(selectedReport.id, editContent);
      alert(data.meta?.versioned ? `Nouvelle version v${data.version} créée` : 'Brouillon mis à jour');
      setEditing(false);
      fetchData();
    } catch (error) {
      console.error('Erreur édition:', error);
      alert('Erreur lors de l\'édition');
    }
  };

  const handleValidateReport = async () => {
    if (!selectedReport) return;
    try {
      const data = await validateReport(selectedReport.id);
      alert('Rapport validé et verrouillé');
      setSelectedReport(data.report);
      fetchData();
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('Erreur lors de la validation');
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'CRITIQUE': return 'bg-red-100 text-red-800 border-red-300';
      case 'ELEVE': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MOYEN': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'FAIBLE': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valide': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'brouillon': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'soumis': return <Eye className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertes en temps réel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Centre d'Alertes</h2>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
            {alerts.length} alerte(s)
          </span>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune alerte active</p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-400">Alerte #{alert.id.slice(0, 8)}</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{alert.summary}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">Urgence: {alert.urgency}</p>
                  </div>
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rapports */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <FileText className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rapports Officiels</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des rapports */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Liste des rapports</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reports.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Aucun rapport disponible</p>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => handleViewReport(report.id)}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(report.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {report.report_type} - v{report.version}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {report.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        report.status === 'valide' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Détails du rapport sélectionné */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Détails du rapport</h3>
            {selectedReport ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Statut</span>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedReport.status)}
                      <span className="text-sm text-gray-900 dark:text-white">{selectedReport.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Version</span>
                    <span className="text-sm text-gray-900 dark:text-white">v{selectedReport.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hash SHA-256</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {selectedReport.cryptographic_hash?.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDownloadPdf(selectedReport.id)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Télécharger PDF</span>
                  </button>
                  {selectedReport.status === 'brouillon' && (
                    <>
                      <button
                        onClick={() => setEditing(!editing)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>Éditer</span>
                      </button>
                      <button
                        onClick={handleValidateReport}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Valider</span>
                      </button>
                    </>
                  )}
                </div>

                {editing && selectedReport.status === 'brouillon' && (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <button
                      onClick={handleEditReport}
                      className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                    >
                      Sauvegarder les modifications
                    </button>
                  </div>
                )}

                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-64 overflow-y-auto">
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                    {selectedReport.content}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Sélectionnez un rapport pour afficher les détails
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
