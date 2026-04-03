from rag_system.indexing.embedders import LanceDBManager
from rag_system.indexing.representations import select_embedder
import lancedb

# CONFIG
DATA_PATH = "data/ai_notes.txt"
TABLE_NAME = "default_text_table"

# Load text
with open(DATA_PATH, "r", encoding="utf-8") as f:
    text = f.read()

# Chunking
chunks = [text[i:i+500] for i in range(0, len(text), 500)]

documents = []
for i, chunk in enumerate(chunks):
    documents.append({
        "chunk_id": f"chunk_{i}",
        "text": chunk,
        "metadata": str({"source": DATA_PATH})
    })

# Embedder
embedder = select_embedder("nomic-embed-text")
embeddings = embedder.create_embeddings([doc["text"] for doc in documents])

# Connect DB directly (IMPORTANT FIX)
db = lancedb.connect("./rag_system/index_store/lancedb")

# Prepare data
data = []
for doc, emb in zip(documents, embeddings):
    data.append({
        "vector": emb,
        "text": doc["text"],
        "chunk_id": doc["chunk_id"],
        "metadata": doc["metadata"]
    })

# ✅ CREATE TABLE (THIS WAS MISSING)
table = db.create_table(TABLE_NAME, data=data, mode="overwrite")

print("Table created and data indexed successfully ✅")