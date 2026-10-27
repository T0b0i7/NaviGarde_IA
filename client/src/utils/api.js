import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

export const getHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const inspectVessel = async (formData) => {
  const response = await api.post('/inspect', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export const transcribeAudio = async (formData) => {
  const response = await api.post('/audio/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export const generateReport = async (inspectionId, alertId = null, type = 'inspection') => {
  const response = await api.post('/generate-report', {
    inspection_id: inspectionId,
    alert_id: alertId,
    type,
  }, {
    headers: {
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export const getReports = async () => {
  // Fallback - list not implemented, but we'll try
  const response = await api.get('/reports', {
    headers: {
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export const getReport = async (id) => {
  const response = await api.get(`/reports/${id}`, {
    headers: {
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export const downloadReportPdf = async (id) => {
  const response = await api.get(`/reports/${id}/download`, {
    headers: {
      'x-dev-role': 'agent',
    },
    responseType: 'blob',
  });
  return response;
};

export const validateReport = async (id) => {
  const response = await api.post(`/reports/${id}/validate`, {}, {
    headers: {
      'x-dev-role': 'supervisor',
    },
  });
  return response.data;
};

export const updateReportDraft = async (id, content) => {
  const response = await api.patch(`/reports/${id}`, { content }, {
    headers: {
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export const getAlerts = async () => {
  const response = await api.get('/alerts', {
    headers: {
      'x-dev-role': 'agent',
    },
  });
  return response.data;
};

export default api;
