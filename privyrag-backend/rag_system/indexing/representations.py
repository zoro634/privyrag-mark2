from typing import List, Dict, Any, Protocol
import numpy as np
import os

class EmbeddingModel(Protocol):
    def create_embeddings(self, texts: List[str]) -> np.ndarray: ...

class OllamaEmbedder(EmbeddingModel):
    def __init__(self, model_name: str = "nomic-embed-text", host: str | None = None, timeout: int = 60):
        self.model_name = model_name
        self.host = (host or os.getenv("OLLAMA_HOST") or "http://localhost:11434").rstrip("/")
        self.timeout = timeout

    def _embed_single(self, text: str):
        import requests
        payload = {"model": self.model_name, "prompt": text}
        r = requests.post(f"{self.host}/api/embeddings", json=payload, timeout=self.timeout)
        r.raise_for_status()
        data = r.json()
        vec = data.get("embedding") or data.get("data")
        return np.array(vec, dtype="float32")

    def create_embeddings(self, texts: List[str]):
        vectors = [self._embed_single(t) for t in texts]
        return np.vstack(vectors)

class EmbeddingGenerator:
    def __init__(self, embedding_model: EmbeddingModel, batch_size: int = 50):
        self.model = embedding_model
        self.batch_size = batch_size

    def generate(self, chunks: List[Dict[str, Any]]):
        texts = [chunk['text'] for chunk in chunks]
        return self.model.create_embeddings(texts)

def select_embedder(model_name: str, ollama_host: str | None = None):
    return OllamaEmbedder(model_name=model_name, host=ollama_host)