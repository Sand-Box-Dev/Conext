export interface HealthStatus {
  status: string;
  ollama_connected: boolean;
  ollama_model: string;
  ollama_model_available: boolean;
  database_connected?: boolean;
  offline_mode?: boolean;
}

export interface UserProfile {
  id: string;
  email?: string;
  role?: string;
  display_name?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
  offline?: boolean;
}

export interface DocumentItem {
  id: number;
  filename: string;
  uploaded_at: string;
  processing_status: 'ready' | 'processing' | 'completed' | 'error';
  chunk_count: number;
  has_map: boolean;
  project_id?: number | null;
  user_id?: string;
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

export interface StudyCitation {
  passage_id: number;
  page_number: number;
}

export interface QuizItem {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  citations: StudyCitation[];
}

export interface FlashcardItem {
  front: string;
  back: string;
  citations: StudyCitation[];
}

export interface EssayRubricCriterion {
  criterion: string;
  points: number;
  description: string;
}

export interface EssayTask {
  title: string;
  prompt: string;
  citations: StudyCitation[];
  rubric: EssayRubricCriterion[];
  submission?: string;
  grade?: EssayGrade;
}

export interface EssayCriterionGrade extends EssayRubricCriterion {
  score: number;
  feedback: string;
}

export interface EssayGrade {
  score: number;
  max_score: number;
  criteria: EssayCriterionGrade[];
  overall_feedback: string;
  strengths: string[];
  next_steps: string[];
  recommendations?: string[];
  citations: StudyCitation[];
}

export type StudyMode = 'quiz' | 'flashcards' | 'essay';

export interface StudyExam {
  id: number;
  mode: StudyMode;
  title: string;
  document_id: number;
  document_filename: string;
  created_at: string;
  content: {
    items?: QuizItem[] | FlashcardItem[];
    title?: string;
    prompt?: string;
    citations?: StudyCitation[];
    rubric?: EssayRubricCriterion[];
    submission?: string;
    grade?: EssayGrade;
  };
}

export interface SavedReviewerMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: ReviewerCitation[];
}

export interface AIMemoryItem {
  id: number;
  user_id?: string;
  document_id?: number;
  memory_type: 'insight' | 'context' | 'preference' | 'summary';
  title: string;
  content: string;
  meta_info?: string;
  created_at: string;
  updated_at: string;
}
