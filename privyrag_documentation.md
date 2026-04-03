# PrivyRAG: Privacy-First Offline Document Intelligence System

## ABSTRACT
PrivyRAG is a full-stack, entirely offline web application designed to provide privacy-first document intelligence and generative AI capabilities. The platform allows users dealing with highly sensitive information—such as legal contracts, medical records, or proprietary financial models—to securely query, analyze, and summarize documents without transmitting data over the internet. It features a modern, responsive user interface built with Next.js, a robust Python HTTP backend, and a serverless LanceDB vector database for efficient semantic search. The system leverages locally hosted Large Language Models (LLMs) via Ollama, completely eliminating cloud computing costs and privacy risks. PrivyRAG includes features such as role-based AI personas, multi-session chat memory, full-file summarization modes, and mathematical confidence scoring for source citations. Its goal is to create a secure, intelligent, and highly accessible document analysis engine that runs entirely on personal hardware.

## INTRODUCTION
Professionals, researchers, and students frequently need to extract precise information or summaries from hundreds of pages of dense documents. While commercial AI engines (like ChatGPT) exist, they require users to upload their sensitive files to remote servers, causing severe compliance and data privacy violations. Furthermore, users often lose track of AI conversations, cannot verify the exact sources of an AI's claims, and struggle to parse huge documents due to token limits. PrivyRAG provides a structured, centralized, and 100% offline platform to solve these issues securely. 

## LITERATURE SURVEY

### Problem Statement
Users dealing with confidential documents do not have a secure, centralized platform to utilize modern AI capabilities. Commercial cloud AIs pose massive security risks, leading to a gap where individuals cannot safely perform semantic searches, cross-document analysis, or large-scale summarizations on their own private hardware.

### Objectives
* To develop a 100% offline Retrieval-Augmented Generation (RAG) system for private document analysis.
* To enable users to upload and manage academic, legal, and medical documents securely via local embedding.
* To implement a dynamic Persona Agent system (Legal, Medical, Financial) to guide AI responses.
* To provide accurate Source Citations accompanied by mathematical Confidence Scores.
* To ensure organized local storage of conversational memory and vector embeddings using a NoSQL-style Vector Database (LanceDB).
* To overcome chunking limitations using a specialized "Full File Summary Agent".

## PROPOSED SYSTEM
The proposed system, PrivyRAG, is a locally-hosted web platform that enables users to upload, manage, and chat with their documents securely. It provides advanced semantic search functionality, a real-time Server-Sent Events (SSE) streaming interface, and a robust verification mechanism via source citations. The system keeps all data, including the LLMs and embeddings, entirely on the host machine, creating a powerful, community-driven, and completely private document intelligence environment.

---

## SYSTEM ARCHITECTURE

**Diagram Description:**
*Generate a diagram showing a three-tier localized architecture.* 
* **Top Layer (Presentation):** The User interacts with the "Next.js Frontend UI" on `localhost:3000`. 
* **Middle Layer (Application Logic):** The UI makes REST API and SSE (Server-Sent Event) calls to the "Python HTTP Backend Server" running on `localhost:8001`.
* **Bottom Layer (Data & AI):** The Python Backend connects directly to two entities: 
  1. "LanceDB Vector Database" (stored in a local folder) for saving and retrieving text vectors.
  2. "Ollama API Service" running on `localhost:11434` for generating embeddings (using `mxbai-embed-large`) and generating LLM text responses (using `llama3:8b`). No external internet exists in this diagram.

## LIST OF FEATURES
* 100% Offline, Privacy-First document processing
* Persistent multi-session chat history and conversational memory
* Dynamic AI Personas (General, Legal, Medical, Financial)
* Source Citations with calculated Confidence Percentages
* PDF and TXT file uploading with automatic recursive chunking
* Server-Sent Events (SSE) for real-time word-by-word text streaming
* "Summary Agent" mode for full-file ingestion bypassing chunk limits
* Instant UI synchronization with the backend LanceDB database
* Chat transcript exporting for record-keeping

## USE CASE DIAGRAM

**Diagram Description:**
*Generate a Use Case diagram with one primary actor:* **User**.
The User actor connects to the following Use Cases inside the system boundary "PrivyRAG System":
* Upload Document (Uses Extends standard parsing)
* Delete Document
* Clear Knowledge Base
* Select AI Persona Model
* Start New Chat Session
* Ask Question (Includes "Retrieve Context" and "Generate AI Response")
* View Source Citations & Confidence
* Export Chat Transcript

## CLASS DIAGRAM

**Diagram Description:**
*Generate a Class Diagram focusing on backend logic and frontend state:*
* **AdvancedRagApiHandler**: Attributes (`HTTP request variables`). Methods (`handle_chat()`, `handle_upload()`, `handle_files()`, `_stream_ollama()`).
* **EmbeddingModel**: Abstract class.
* **OllamaEmbedder**: Inherits EmbeddingModel. Attributes (`model_name`, `host`). Methods (`create_embeddings()`, `_embed_single()`).
* **ChatSession (Frontend Interface)**: Attributes (`id`, `title`, `messages: List[Message]`, `updatedAt`).
* **Message (Frontend Interface)**: Attributes (`text`, `role`, `timestamp`, `sources`).

## SEQUENCE DIAGRAM

**Diagram Description:**
*Generate a Sequence Diagram for the process of "Asking a Question":*
1. **User** types a query and clicks send on the **Frontend UI**.
2. **Frontend UI** sends a `POST /chat` request to the **Python Backend**.
3. **Python Backend** sends the query string to the **Ollama Embedder** to get a query vector.
4. **Ollama Embedder** returns the mathematical vector.
5. **Python Backend** sends the vector to **LanceDB**, querying `table.search(vector).limit(25)`.
6. **LanceDB** returns the most relevant text chunks and L2 Distances.
7. **Python Backend** constructs a massive prompt containing the chunks, conversational history, and persona, sending it to the **Ollama Generation API**.
8. **Ollama Generation API** immediately begins returning generated text tokens stream.
9. **Python Backend** tunnels these tokens back to the **Frontend UI** via SSE.
10. **Frontend UI** renders the text word-by-word for the **User**.

## ACTIVITY DIAGRAM

**Diagram Description:**
*Generate an Activity Diagram representing the "Document Upload Workflow":*
1. **Start Node**: User selects a PDF/TXT file.
2. **Action Node**: Frontend reads file and sends base64/text via `POST /upload`.
3. **Decision Node**: Is the file a PDF? 
   * If Yes -> **Action Node**: Extract text using `PyPDF2`. -> Go to Chunking.
   * If No -> Proceed directly to Chunking.
4. **Action Node**: Apply Recursive Character Text Splitting with 150-char overlap.
5. **Action Node**: Divide chunks into batches of 100.
6. **Action Node**: Send batches to Ollama embedding model.
7. **Action Node**: Receive multi-dimensional vector arrays.
8. **Action Node**: Save metadata (filename) and vectors into LanceDB `default_text_table`.
9. **End Node**: Return Success to UI and display Toast notification.

## COMPONENT DIAGRAM

**Diagram Description:**
*Generate a Component Diagram showing independent modules:*
* **UI Component**: Next.js (React) rendering the dashboard.
* **API Server Component**: Python server parsing requests and routing data.
* **Embedding Module Component**: Code that chunks and manages vector embeddings.
* **Database Component (LanceDB)**: The physical local storage folder managing indexing algorithms.
* **LLM Engine Component (Ollama)**: The background service running models on CPU/GPU.

## DEPLOYMENT DIAGRAM

**Diagram Description:**
*Generate a Deployment Diagram representing a single "Local Host Machine" node:*
Inside the **User's Physical Computer / Laptop Site**:
* **Execution Environment 1 (Node.js)**: Runs the compiled Next.js Frontend App on Port 3000.
* **Execution Environment 2 (Python Runtime)**: Runs `api_server.py` on Port 8001. Handles computations. Files stored locally in `./lancedb` folder.
* **Execution Environment 3 (Ollama Daemon)**: Runs as a native background service on Port 11434. Has direct access to the computer's CPU/GPU for heavy LLM processing.

---

## SOFTWARE REQUIREMENTS
* **Operating System**: Windows 10/11 / Linux (Ubuntu) / macOS
* **Frontend**: Next.js, React, Tailwind CSS, TypeScript
* **Backend**: Python 3.11+, Base HTTP Server
* **Database**: LanceDB (Serverless Vector DB)
* **AI Engine**: Ollama (Local Daemon)
* **AI Models Required**: `llama3:8b` (LLM Generation), `nomic-embed-text` / `mxbai-embed-large` (Embedding)
* **Browser**: Google Chrome / Brave / Edge

## HARDWARE REQUIREMENTS
* **Processor**: Intel i5 / AMD Ryzen 5 (Minimum), Apple Silicon or Dedicated GPU (Recommended for fast token generation)
* **RAM**: Minimum 8 GB (16 GB highly recommended to hold `llama3:8b` in active memory)
* **Storage**: At least 15 GB of free space (to store the necessary AI models weights natively)
* **Internet connection**: REQUIRED ONLY for initial setup/installation. 100% Offline during actual software usage.

## CONCLUSION
PrivyRAG provides a groundbreaking, highly secure platform for deep document intelligence. By completely localizing the AI architecture, it fundamentally solves the privacy and cost limitations of cloud-based commercial AI. Its implementation of semantic vector search, dynamic conversational memory, and source verification ensures users receive incredibly accurate insights. Overall, the system promotes profound, secure analytical learning and workflows for students and professionals alike.
