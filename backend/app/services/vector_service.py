import json
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session
from ..models import Document, SourceChunk

logger = logging.getLogger(__name__)

class VectorService:
    """
    Offline Vector Store & Retrieval Service.
    Computes passage vector embeddings using TF-IDF sparse vector representations,
    stores the vector representations in the SQLite SourceChunk table,
    and supports cosine similarity search and representative passage selection.
    """

    @staticmethod
    def vector_to_json(sparse_vector: Dict[str, float]) -> str:
        return json.dumps(sparse_vector)

    @staticmethod
    def json_to_vector(vector_str: Optional[str]) -> Dict[str, float]:
        if not vector_str:
            return {}
        try:
            return json.loads(vector_str)
        except Exception:
            return {}

    @classmethod
    def vectorize_chunks(cls, chunks: List[SourceChunk], db: Session) -> None:
        """
        Calculates and persists vector representations for all chunks of a document.
        Uses sublinear term-frequency weighting and standard cosine normalization.
        """
        if not chunks:
            return

        texts = [c.content for c in chunks]
        
        # Fit TF-IDF model on document corpus
        vectorizer = TfidfVectorizer(
            max_features=1024,
            sublinear_tf=True,
            stop_words='english'
        )
        
        try:
            tfidf_matrix = vectorizer.fit_transform(texts)
            feature_names = vectorizer.get_feature_names_out()

            # Store non-zero weights for each chunk
            for i, chunk in enumerate(chunks):
                row = tfidf_matrix.getrow(i)
                _, col_indices = row.nonzero()
                weights = row.data
                
                sparse_dict = {
                    feature_names[col]: round(float(weight), 5)
                    for col, weight in zip(col_indices, weights)
                }
                chunk.embedding = cls.vector_to_json(sparse_dict)

            db.commit()
            logger.info(f"Vectorized {len(chunks)} chunks successfully.")
        except Exception as e:
            logger.error(f"Vectorization failed: {e}")
            db.rollback()
            raise

    @classmethod
    def select_top_semantic_chunks(
        cls,
        chunks: List[SourceChunk],
        max_count: int = 15
    ) -> List[SourceChunk]:
        """
        Uses vector embeddings to select the most representative, high-information
        and semantically diverse passages for the concept map extraction pipeline.
        Ensures overview passages and distinct topical clusters across the document are selected.
        """
        if len(chunks) <= max_count:
            return chunks

        # Prioritize introductory passages (e.g. first 2 chunks)
        selected_indices = [0, min(1, len(chunks) - 1)]
        selected_set = set(selected_indices)

        # Build TF-IDF vectors for clustering/diversity selection
        texts = [c.content for c in chunks]
        vectorizer = TfidfVectorizer(
            max_features=512,
            sublinear_tf=True,
            stop_words='english'
        )
        tfidf_matrix = vectorizer.fit_transform(texts)

        # Compute passage importance (sum of TF-IDF scores)
        importance_scores = np.asarray(tfidf_matrix.sum(axis=1)).ravel()

        # Iteratively select chunks that have high importance but low redundancy with already selected chunks
        while len(selected_indices) < max_count and len(selected_indices) < len(chunks):
            current_matrix = tfidf_matrix[selected_indices]
            # Max similarity to any already selected chunk
            sims = cosine_similarity(tfidf_matrix, current_matrix).max(axis=1)

            # Combined score: high importance, penalized by similarity to already selected chunks
            best_idx = None
            best_score = -float('inf')

            for idx in range(len(chunks)):
                if idx in selected_set:
                    continue
                score = importance_scores[idx] - (sims[idx] * 0.8 * importance_scores.max())
                if score > best_score:
                    best_score = score
                    best_idx = idx

            if best_idx is not None:
                selected_indices.append(best_idx)
                selected_set.add(best_idx)
            else:
                break

        # Sort selected chunks by original document order so the LLM reads chronologically
        selected_indices.sort()
        return [chunks[i] for i in selected_indices]
