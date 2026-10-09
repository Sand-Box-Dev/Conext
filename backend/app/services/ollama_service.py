import json
import re
import logging
from typing import Dict, Any, Optional
import httpx
from ..schemas import ExtractionResult

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "gemma4:31b-cloud"

async def check_ollama_health(model_name: str = DEFAULT_MODEL) -> Dict[str, Any]:
    """
    Checks if Ollama daemon is reachable and whether the target model is downloaded locally.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                # Match either exact name or model name prefix (e.g. gemma4:31b-cloud or gemma4:31b-cloud-...)
                has_model = any(m == model_name or m.startswith(f"{model_name}:") or m.startswith(model_name) for m in models)
                return {
                    "connected": True,
                    "model": model_name,
                    "available": has_model,
                    "models_list": models
                }
    except Exception as e:
        logger.warning(f"Ollama health check failed: {e}")
    
    return {
        "connected": False,
        "model": model_name,
        "available": False,
        "models_list": []
    }

async def generate_concept_map_from_passages(
    passages_text: str,
    doc_title: str,
    model_name: str = DEFAULT_MODEL,
    strict_retry: bool = False
) -> ExtractionResult:
    """
    Calls local Ollama with structured JSON schema to extract concepts and relationships
    grounded strictly in the supplied numbered passages.
    """
    system_prompt = (
        "You are an offline, document-grounded concept extraction engine. "
        "Your task is to identify key educational concepts and relationships using ONLY the supplied numbered source passages.\n"
        "STRICT GROUNDING RULES:\n"
        "1. Every concept must include at least one valid supporting passage ID from the provided text in 'source_passage_ids'.\n"
        "2. Do NOT introduce external knowledge, facts, or entities not explicitly present in the source passages.\n"
        "3. Provide a clear, beginner-friendly explanation strictly grounded in the document for each concept.\n"
        "4. Assign node_type as 'root' for the overarching main topic, 'concept' for key core concepts, and 'subconcept' for supporting details.\n"
        "5. Extract 5 to 12 meaningful concepts.\n"
        "6. In 'relationships', describe valid connections between concepts (e.g. 'source_label', 'target_label', 'relationship'). Both source and target must be exact concept labels.\n"
        "7. Return strictly a JSON object conforming to the schema."
    )

    if strict_retry:
        system_prompt += "\nATTENTION: Your previous output had validation errors. Ensure EVERY source_passage_id is an exact integer ID present in the text, and return valid JSON only."

    user_prompt = f"Document: {doc_title}\n\nSource Passages:\n{passages_text}\n\nGenerate the structured concept map JSON now:"

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "format": ExtractionResult.model_json_schema(),
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_ctx": 4096
        }
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"Ollama API error ({response.status_code}): {response.text}")
            
            res_json = response.json()
            message_content = res_json.get("message", {}).get("content", "")
            
            # Parse JSON cleanly even if wrapped in markdown code blocks
            clean_content = message_content.strip()
            # Strip markdown code blocks like ```json ... ``` or ``` ... ```
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_content)
            if match:
                clean_content = match.group(1).strip()
            else:
                json_match = re.search(r"(\{[\s\S]*\})", clean_content)
                if json_match:
                    clean_content = json_match.group(1).strip()

            parsed = json.loads(clean_content)
            return ExtractionResult.model_validate(parsed)
            
    except Exception as e:
        logger.error(f"Ollama generation failed: {e}")
        if not strict_retry:
            logger.info("Retrying once with stricter instructions...")
            return await generate_concept_map_from_passages(
                passages_text=passages_text,
                doc_title=doc_title,
                model_name=model_name,
                strict_retry=True
            )
        raise
