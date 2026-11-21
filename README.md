PrivyRAG
Privacy-first, locally hosted document intelligence powered by Retrieval-Augmented Generation (RAG).
PrivyRAG is a full-stack web application that lets users upload, search, question, and summarize documents using locally running AI models. It is designed for workflows involving sensitive information: document content, embeddings, vector storage, and LLM inference remain on the host machine when the application is run in its local configuration.
The project combines a Next.js interface, a Python backend, LanceDB for vector storage, and Ollama for local model execution.
Key Features
Local-first document intelligence — process documents with locally hosted models instead of sending their content to a cloud AI API.
PDF and TXT ingestion — extract text, split it into overlapping chunks, and index the chunks for retrieval.
Semantic search — retrieve relevant passages using vector embeddings and LanceDB.
Conversational Q&A — ask questions about indexed documents through a RAG pipeline.
Streaming responses — receive generated answers incrementally through Server-Sent Events (SSE).
Source references — display retrieved document context alongside generated answers, with confidence information where supported by the implementation.
AI personas — switch response styles for General, Legal, Medical, and Financial use cases.
Document and knowledge-base management — upload and delete documents, and clear the local knowledge base.
Chat sessions and history — maintain separate conversations and conversational context.
Document summarization — generate summaries, including cross-document summaries where supported.
Chat export — export conversation transcripts for later reference.
> **Important:** AI-generated output is informational and may be inaccurate. Legal, medical, and financial personas do not replace qualified professional advice. Verify important claims against the cited source documents.
Architecture
```text
┌──────────────────────────────┐
│        User / Browser        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       Next.js Frontend       │
│       localhost:3000         │
│  Upload • Chat • Sources     │
└──────────────┬───────────────┘
               │ REST API + SSE
               ▼
┌──────────────────────────────┐
│       Python Backend         │
│       localhost:8001         │
│  Ingestion • Chunking • RAG  │
└──────────┬───────────┬───────┘
           │           │
           ▼           ▼
┌────────────────┐  ┌────────────────┐
│    LanceDB     │  │     Ollama     │
│ Local vectors  │  │ Local AI models│
└────────────────┘  └────────────────┘
```
Document processing flow
The user uploads a supported document through the web interface.
The backend extracts its text (PDF extraction is handled by the PDF parsing component).
Extracted text is split into overlapping chunks to preserve context.
Ollama generates embeddings for the chunks.
LanceDB stores the vectors and associated document metadata locally.
When a user asks a question, the backend embeds the query and retrieves relevant chunks.
The retrieved context is included in a prompt sent to the local LLM.
The generated response is streamed to the frontend, along with source information where available.
Technology Stack
Layer	Technologies
Frontend	Next.js, React, TypeScript, Tailwind CSS
Backend	Python, HTTP server, REST API, Server-Sent Events
Vector database	LanceDB
Local model runtime	Ollama
Embeddings	`mxbai-embed-large` (or the embedding model configured in your installation)
Text generation	Llama 3 through Ollama (or the generation model configured in your installation)
Document processing	PyPDF2, recursive text chunking
Data handling	Pandas
Repository Structure
```text
privyrag-mark2/
├── privyrag-backend/       # Python API, document ingestion and RAG logic
├── privyrag-ui/            # Next.js frontend
├── PrivyRAG_Project_Report.md
├── privyrag_documentation.md
└── README.md
```
The backend and frontend are maintained as separate applications. Run their setup commands from their respective directories.
Prerequisites
Install the following before running the project:
Git
Python 3.10 or newer (Python 3.11+ is recommended)
Node.js and npm compatible with the frontend's package configuration
Ollama
Sufficient RAM and disk space for your selected local models
A machine with 16 GB RAM or more is recommended for a smoother local-model experience. Actual requirements depend on the model size and whether inference uses CPU or GPU acceleration.
Setup and Installation
1. Clone the repository
```bash
git clone https://github.com/zoro634/privyrag-mark2.git
cd privyrag-mark2
```
2. Set up Ollama
Install Ollama from ollama.com, start the Ollama service, and download the models used by your configuration.
For the model names documented for this project:
```bash
ollama pull llama3:8b
ollama pull mxbai-embed-large
```
If your backend configuration specifies different model names, pull those exact models and use the same names in the application configuration.
Check that Ollama is available:
```bash
ollama list
```
Ollama normally exposes its local API at `http://localhost:11434`.
3. Set up the backend
Open a terminal in the backend directory:
```bash
cd privyrag-backend
```
Create and activate a virtual environment:
```bash
python -m venv .venv
```
Windows (PowerShell):
```powershell
.venv\Scripts\Activate.ps1
```
Linux / macOS:
```bash
source .venv/bin/activate
```
Install the backend dependencies using the dependency file present in the backend directory. For example, if it contains `requirements.txt`:
```bash
pip install -r requirements.txt
```
Start the backend using the entry-point file and command provided by the backend directory. The project documentation describes the Python API server as running on:
```text
http://localhost:8001
```
> The exact backend start command and dependency filename should be taken from the current `privyrag-backend` contents; they may change as the project evolves.
4. Set up the frontend
Open another terminal:
```bash
cd privyrag-mark2/privyrag-ui
```
Install the Node.js dependencies:
```bash
npm install
```
Start the development server using the package script:
```bash
npm run dev
```
The frontend is documented as running at:
```text
http://localhost:3000
```
Open that address in your browser after both the backend and Ollama are running.
Using PrivyRAG
Start Ollama and ensure the required models are available.
Start the Python backend.
Start the Next.js frontend.
Open the web application at `http://localhost:3000`.
Upload a supported PDF or TXT document.
Wait for the document to be processed and indexed.
Start a chat and ask questions about the uploaded content.
Select an available persona when you want a domain-oriented response.
Review the retrieved sources to validate the answer.
Use the available document, chat, summary, and export controls as needed.
Configuration Notes
Model names, server addresses, ports, storage locations, and other runtime settings are determined by the current backend and frontend configuration.
Before running the application, check the source configuration for:
Ollama host URL (normally `http://localhost:11434`)
Text-generation model name (for example, `llama3:8b`)
Embedding model name (for example, `mxbai-embed-large`)
Backend API address (documented as `http://localhost:8001`)
Frontend address (documented as `http://localhost:3000`)
Local LanceDB storage directory
Do not commit API keys, passwords, private documents, local database files, or other sensitive data to the repository.
Privacy and Security
PrivyRAG is designed around local processing. To preserve that model:
Run Ollama and the backend on a trusted machine.
Keep uploaded documents and the vector database in protected local storage.
Do not expose the backend, Ollama service, or development server to untrusted networks.
Review any changes to the code that introduce external APIs, telemetry, or remote storage.
Back up the local database and documents securely.
Treat generated answers as suggestions and verify them against source material.
Local execution alone does not guarantee security. Your operating system, network configuration, dependencies, logs, backups, and access controls also affect data protection.
Troubleshooting
Problem	What to check
Frontend cannot reach backend	Confirm the Python server is running and the frontend is configured with the correct backend URL.
Ollama connection error	Start Ollama and verify that `http://localhost:11434` is reachable.
Model not found	Run `ollama list` and pull the exact model name configured by the backend.
Slow responses	Try a smaller model, reduce document/query workload, or use supported GPU acceleration.
No relevant search results	Confirm the document finished indexing and check the embedding model configuration.
PDF text is missing	The PDF may be scanned or image-based; OCR support may be required.
Dependency installation fails	Check the required Python and Node.js versions and install dependencies from the relevant application directory.
Current Scope and Future Enhancements
The project documentation identifies the following possible extensions:
OCR support for scanned and image-based PDFs.
Additional document formats such as DOCX, XLSX, and CSV.
Multi-agent workflows for comparing and validating generated insights.
Graph-based retrieval (GraphRAG) for exploring relationships across documents.
These are potential enhancements and should not be considered implemented unless they are present in the current codebase.
Documentation
Project Report
Technical Documentation
Contributing
Contributions, bug reports, and suggestions are welcome.
Fork the repository.
Create a feature branch: `git checkout -b feature/your-feature`.
Commit your changes with a clear message.
Push the branch and open a pull request describing the change.
License
No license is currently specified in the repository. Unless a license is added, the default copyright rules apply and reuse or redistribution is not automatically permitted.
---
Built with a privacy-first approach to local document intelligence.
