import type { HealthStatus, DocumentItem, ConceptMapData, ConceptDetail } from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch backend health status');
    return res.json();
  },

  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async uploadDocument(file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Failed to upload document');
    }
    return res.json();
  },

  async getDocument(id: number): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    if (!res.ok) throw new Error('Failed to fetch document');
    return res.json();
  },

  async generateConceptMap(documentId: number): Promise<ConceptMapData> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/generate`, {
      method: 'POST',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate map' }));
      throw new Error(err.detail || 'Failed to generate concept map');
    }
    return res.json();
  },

  async getConceptMap(documentId: number): Promise<ConceptMapData> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/map`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Map not found' }));
      throw new Error(err.detail || 'Concept map not found');
    }
    return res.json();
  },

  async getConceptDetails(conceptId: number): Promise<ConceptDetail> {
    const res = await fetch(`${API_BASE}/concepts/${conceptId}`);
    if (!res.ok) throw new Error('Failed to fetch concept details');
    return res.json();
  },
};
