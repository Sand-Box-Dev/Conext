export interface HealthStatus {
  status: string;
  ollama_connected: boolean;
  ollama_model: string;
  ollama_model_available: boolean;
}

export interface DocumentItem {
  id: number;
  filename: string;
  uploaded_at: string;
  processing_status: 'ready' | 'processing' | 'completed' | 'error';
  chunk_count: number;
  has_map: boolean;
  project_id: number | null;
}

export interface ProjectFolder {
  id: number;
  name: string;
  created_at: string;
  document_count: number;
}

export interface ConceptNodeData extends Record<string, unknown> {
  id: number;
  concept_map_id: number;
  label: string;
  explanation: string;
  node_type: 'root' | 'concept' | 'subconcept';
  source_chunk_ids: number[];
  isSelected?: boolean;
}

export interface ConceptEdgeData {
  id: number;
  concept_map_id: number;
  source_node_id: number;
  target_node_id: number;
  relationship: string;
}

export interface ConceptMapData {
  id: number;
  document_id: number;
  title: string;
  created_at: string;
  nodes: ConceptNodeData[];
  edges: ConceptEdgeData[];
}

export interface SourceChunkItem {
  id: number;
  page_number: number;
  chunk_index: number;
  content: string;
  document_filename?: string;
}

export interface ConceptDetail {
  id: number;
  label: string;
  explanation: string;
  has_generated_explanation: boolean;
  node_type: string;
  sources: SourceChunkItem[];
}

export interface ReviewerCitation {
  passage_id: number;
  page_number: number;
  excerpt: string;
}

export interface ReviewerAnswer {
  message_id: number;
  answer: string;
  citations: ReviewerCitation[];
}

export interface SavedReviewerMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: ReviewerCitation[];
}
