/**
 * SiteSentry API Client Service
 */

const API_BASE = '/api';

export async function startAudit(url) {
  const response = await fetch(`${API_BASE}/audits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to start audit');
  }

  return data;
}

export async function fetchAuditById(id) {
  const response = await fetch(`${API_BASE}/audits/${id}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to retrieve audit');
  }

  return data.audit;
}

export async function fetchAuditHistory(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await fetch(`${API_BASE}/audits${query}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to retrieve audit history');
  }

  return data.audits || [];
}

export async function deleteAuditRecord(id) {
  const response = await fetch(`${API_BASE}/audits/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete audit');
  }

  return data;
}

export function getExportUrl(id, format = 'json') {
  return `${API_BASE}/audits/${id}/export/${format}`;
}

export async function generateAiBrief(auditId) {
  const response = await fetch(`${API_BASE}/audits/${auditId}/ai-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate AI executive brief');
  }

  return data;
}

export async function generateFindingAiFix(auditId, findingId) {
  const response = await fetch(`${API_BASE}/audits/${auditId}/findings/${findingId}/ai-fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate AI fix');
  }

  return data;
}
