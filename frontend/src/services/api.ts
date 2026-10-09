import type {
  HealthStatus,
  DocumentItem,
  ConceptMapData,
  ConceptDetail,
  ReviewerAnswer,
  SavedReviewerMessage,
  ProjectFolder,
  AuthResponse,
  UserProfile,
  AIMemoryItem,
} from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

const TOKEN_KEY = 'conext_auth_token';
const USER_KEY = 'conext_auth_user';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): UserProfile | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser(user: UserProfile) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

function getAuthHeaders(): HeadersInit {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data: AuthResponse = await res.json();
    if (data.access_token) {
      authStorage.setToken(data.access_token);
      authStorage.setUser(data.user);
    }
    return data;
  },

  async signUp(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Sign up failed' }));
      throw new Error(err.detail || 'Sign up failed');
    }
    const data: AuthResponse = await res.json();
    if (data.access_token) {
      authStorage.setToken(data.access_token);
      authStorage.setUser(data.user);
    }
    return data;
  },

  async getMe(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch user profile');
    return res.json();
  },

  async updateProfile(data: { display_name?: string; password?: string }): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not update account settings' }));
      throw new Error(err.detail || 'Could not update account settings');
    }
    return res.json();
  },

  logout() {
    authStorage.clear();
  },

  // Health check
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch backend health status');
    return res.json();
  },

  // Documents
  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getDocument(documentId: number): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to refresh reviewer status');
    return res.json();
  },

  async getTrashedDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents/trash`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Could not load Trash');
    return res.json();
  },

  async moveDocumentToTrash(documentId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/trash`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not move reviewer to Trash' }));
      throw new Error(err.detail || 'Could not move reviewer to Trash');
    }
  },

  async restoreDocument(documentId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not restore reviewer' }));
      throw new Error(err.detail || 'Could not restore reviewer');
    }
  },

  async deleteDocumentForever(documentId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not permanently delete reviewer' }));
      throw new Error(err.detail || 'Could not permanently delete reviewer');
    }
  },

  async getProjects(): Promise<ProjectFolder[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch project folders');
    return res.json();
  },

  async createProject(name: string): Promise<ProjectFolder> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not create folder' }));
      throw new Error(err.detail || 'Could not create folder');
    }
    return res.json();
  },

  async renameProject(projectId: number, name: string): Promise<ProjectFolder> {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not rename folder' }));
      throw new Error(err.detail || 'Could not rename folder');
    }
    return res.json();
  },

  async deleteProject(projectId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not delete folder' }));
      throw new Error(err.detail || 'Could not delete folder');
    }
  },

  async assignProject(documentId: number, projectId: number | null): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/project`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not move reviewer' }));
      throw new Error(err.detail || 'Could not move reviewer');
    }
  },

  async uploadDocument(file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Failed to upload document');
    }
    return res.json();
  },

  async getDocument(id: number): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch document');
    return res.json();
  },

  async getOriginalDocumentFile(id: number): Promise<Blob> {
    const res = await fetch(`${API_BASE}/documents/${id}/file`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not load the original file.' }));
      throw new Error(err.detail || 'Could not load the original file.');
    }
    return res.blob();
  },

  async generateConceptMap(documentId: number): Promise<ConceptMapData> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate map' }));
      throw new Error(err.detail || 'Failed to generate concept map');
    }
    return res.json();
  },

  async getConceptMap(documentId: number): Promise<ConceptMapData> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/map`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Map not found' }));
      throw new Error(err.detail || 'Concept map not found');
    }
    return res.json();
  },

  async getConceptDetails(conceptId: number): Promise<ConceptDetail> {
    const res = await fetch(`${API_BASE}/concepts/${conceptId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch concept details');
    return res.json();
  },

  async improveConceptExplanation(conceptId: number): Promise<{ explanation: string; has_generated_explanation: boolean }> {
    const res = await fetch(`${API_BASE}/concepts/${conceptId}/explain`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not generate an explanation' }));
      throw new Error(err.detail || 'Could not generate an explanation');
    }
    return res.json();
  },

  async askReviewer(documentId: number, question: string): Promise<ReviewerAnswer> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not answer that question' }));
      throw new Error(err.detail || 'Could not answer that question');
    }
    return res.json();
  },

  async getReviewerChat(documentId: number): Promise<SavedReviewerMessage[]> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/chat`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Could not load saved chat' }));
      throw new Error(err.detail || 'Could not load saved chat');
    }
    return res.json();
  },

  // Memories & context
  async getMemories(documentId?: number): Promise<AIMemoryItem[]> {
    const query = documentId ? `?document_id=${documentId}` : '';
    const res = await fetch(`${API_BASE}/memories${query}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  },
};
