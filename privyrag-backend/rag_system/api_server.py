import json
import http.server
import socketserver
import requests

# Try loading RAG (optional)
try:
    from rag_system.main import get_agent
    RAG_AGENT = get_agent("default")
    print("RAG Agent loaded successfully")
except Exception as e:
    print("RAG load failed, using manual retrieval:", e)
    RAG_AGENT = None


class AdvancedRagApiHandler(http.server.BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == "/chat":
            self.handle_chat()
        elif self.path == "/upload":
            self.handle_upload()
        elif self.path == "/clear_docs":
            self.handle_clear_docs()
        elif self.path == "/delete_doc":
            self.handle_delete_doc()
        elif self.path == "/summarize_all":
            self.handle_summarize_all()
        else:
            self.send_json_response({"error": "Not Found"}, 404)

    def handle_upload(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            filename = data.get("filename")
            content = data.get("content")

            if not filename or not content:
                self.send_json_response({"error": "filename and content required"}, 400)
                return

            if filename.lower().endswith(".pdf"):
                import base64, io, PyPDF2
                try:
                    if "," in content:
                        content = content.split(",")[1]
                    pdf_bytes = base64.b64decode(content)
                    pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
                    extracted = []
                    for page in pdf_reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            extracted.append(page_text)
                    content = "\n\n".join(extracted)
                except Exception as e:
                    self.send_json_response({"error": f"Failed to parse PDF: {str(e)}"}, 400)
                    return

            import lancedb
            from rag_system.indexing.representations import select_embedder

            db = lancedb.connect("./lancedb")
            embedder = select_embedder("mxbai-embed-large")

            # Native Recursive Character Text Splitting with Overlap
            def recursive_chunking(text, max_length=1200, overlap=150):
                import re
                base_chunks = []
                paragraphs = re.split(r'\n\n+', text)
                for p in paragraphs:
                    p = p.strip()
                    if not p: continue
                    if len(p) <= max_length:
                        base_chunks.append(p)
                    else:
                        sentences = re.split(r'(?<=[.!?])\s+', p)
                        curr = ""
                        for s in sentences:
                            if len(curr) + len(s) <= max_length:
                                curr += s + " "
                            else:
                                if curr: base_chunks.append(curr.strip())
                                curr = s + " "
                        if curr: base_chunks.append(curr.strip())
                
                # Apply sliding window overlap to context stitch
                final_chunks = []
                for i in range(len(base_chunks)):
                    if i == 0:
                        final_chunks.append(base_chunks[i])
                    else:
                        # Grab end of previous chunk
                        prev = base_chunks[i-1]
                        if len(prev) > overlap:
                            overlap_text = prev[-overlap:]
                            space_idx = overlap_text.find(' ') # find first space to avoid cutting words
                            if space_idx != -1: overlap_text = overlap_text[space_idx+1:]
                            final_chunks.append((overlap_text + " " + base_chunks[i]).strip())
                        else:
                            final_chunks.append(base_chunks[i])
                return final_chunks if final_chunks else [text]

            chunks = recursive_chunking(content, max_length=1200, overlap=150)

            # Batch the embeddings so it doesn't crash on huge legal documents
            BATCH_SIZE = 100
            vectors = []
            print(f"[{filename}] Chunked into {len(chunks)} pieces. Starting embedding...")
            
            for i in range(0, len(chunks), BATCH_SIZE):
                batch_chunks = chunks[i:i+BATCH_SIZE]
                print(f"[{filename}] Embedding batch {i} to {i+len(batch_chunks)} of {len(chunks)}...")
                batch_vectors = embedder.create_embeddings(batch_chunks)
                
                # Add filename to the schema so it clearly tracks source
                data_to_insert = [{"text": chunk, "vector": vec, "filename": filename} for chunk, vec in zip(batch_chunks, batch_vectors)]
                
                try:
                    table = db.open_table("default_text_table")
                    table.add(data_to_insert)
                except Exception:
                    db.create_table("default_text_table", data=data_to_insert)
                
            print(f"[{filename}] Finished embedding and saving to LanceDB...")

            self.send_json_response({"success": True, "message": f"Successfully processed {filename}"})
        except Exception as e:
            self.send_json_response({"error": f"Server error: {str(e)}"}, 500)

    def do_GET(self):
        if self.path == "/models":
            self.handle_models()
        elif self.path == "/files":
            self.handle_files()
        else:
            self.send_json_response({"error": "Not Found"}, 404)

    def handle_files(self):
        try:
            import lancedb
            db = lancedb.connect("./lancedb")
            try:
                table = db.open_table("default_text_table")
                df = table.to_pandas()
                files = list(df["filename"].unique())
                file_list = [{"name": str(f), "date": "1970-01-01T00:00:00.000Z"} for f in files]
                self.send_json_response({"files": file_list})
            except Exception:
                self.send_json_response({"files": []})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_clear_docs(self):
        try:
            import lancedb
            db = lancedb.connect("./lancedb")
            try:
                db.drop_table("default_text_table")
            except Exception:
                pass
            self.send_json_response({"success": True, "message": "Knowledge base cleared"})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_delete_doc(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            filename = data.get("filename")
            
            if not filename:
                self.send_json_response({"error": "filename required"}, 400)
                return

            import lancedb
            db = lancedb.connect("./lancedb")
            try:
                table = db.open_table("default_text_table")
                table.delete(f"`filename` = '{filename}'")
            except Exception:
                pass
                
            self.send_json_response({"success": True, "message": f"Deleted {filename}"})
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_summarize_all(self):
        try:
            import lancedb
            db = lancedb.connect("./lancedb")
            try:
                table = db.open_table("default_text_table")
                df = table.to_pandas()
                if len(df) == 0:
                    self.send_json_response({"error": "Knowledge base is empty."}, 400)
                    return
                
                # Group text
                all_text = ""
                for fname, group in df.groupby("filename"):
                    all_text += f"\n\n--- Document: {fname} ---\n"
                    all_text += "\n".join(group["text"].tolist())
                
                prompt = f"""
You are an expert analyst. Read the following uploaded documents and provide a highly comprehensive Executive Summary.
Compare their contents, highlight shared risks or liabilities, outline key milestones/metrics, and summarize everything perfectly using Markdown formatting.

{all_text}
"""
                self._stream_ollama(prompt, "Summarizing all documents...")
            except Exception as e:
                self.send_json_response({"error": f"DB Error: {str(e)}"}, 400)
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    # 🔥 FINAL CHAT (MANUAL RAG - GUARANTEED WORKING)
    def handle_chat(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            query = data.get("query")
            doc_type = data.get("doc_type", "general").lower()
            history = data.get("history", [])
            llm_model = data.get("llm_model", "llama3:8b")
            target_file = data.get("target_file", "all")

            if not query:
                self.send_json_response({"error": "Query is required"}, 400)
                return

            import lancedb
            from rag_system.indexing.representations import select_embedder

            db = lancedb.connect("./lancedb")
            
            context = ""
            sources = []
            
            if doc_type == "summarize":
                try:
                    table = db.open_table("default_text_table")
                    df = table.to_pandas()
                    if target_file != "all":
                        df = df[df["filename"] == target_file]
                    if len(df) > 0:
                        context_pieces = []
                        for fname, group in df.groupby("filename"):
                            fname_str = f"{fname} (Full File)"
                            if fname_str not in sources:
                                sources.append(fname_str)
                            context_pieces.append(f"--- Document: {fname} ---\n" + "\n".join(group["text"].tolist()))
                        context = "\n\n".join(context_pieces)
                except Exception as e:
                    print("Table not found or empty:", e)
            else:
                try:
                    embedder = select_embedder("mxbai-embed-large")
                    query_vector = embedder.create_embeddings([query])[0]
                    table = db.open_table("default_text_table")
                    search_query = table.search(query_vector)
                    if target_file != "all":
                        # Apply LanceDB vector pre-filtering
                        search_query = search_query.where(f"filename = '{target_file}'")
                    results = search_query.limit(25).to_df()
                    if len(results) > 0:
                        context_pieces = []
                        source_scores = {}
                        for _, row in results.iterrows():
                            file_source = row.get("filename", "Unknown")
                            
                            # LanceDB defaults to L2 distance. Smaller is closer.
                            dist = row["_distance"] if "_distance" in row else 0.5
                            conf = max(0, min(100, int((1.0 - (float(dist) / 2.0)) * 100)))
                            
                            if file_source not in source_scores:
                                source_scores[file_source] = conf
                            else:
                                source_scores[file_source] = max(source_scores[file_source], conf)
                                
                            context_pieces.append(f"--- Source: {file_source} ---\n{row['text']}")
                            
                        sources = [f"{k} (Score: {v}%)" for k, v in source_scores.items()]
                        context = "\n\n".join(context_pieces)
                except Exception as e:
                    print("Table not found or empty:", e)

            personas = {
                "general": "Answer directly and clearly. Synthesize the context with your own expert knowledge to provide original insights. Do not just blindly repeat the text.",
                "legal": "You are an expert legal assistant. Analyze the context but also use your own broader legal knowledge to foresee undocumented risks and provide strategic insights.",
                "medical": "You are an expert medical assistant. Analyze the context, but also use your own medical expertise to hypothesize on conditions and provide nuanced opinions.",
                "financial": "You are an expert financial analyst. Beyond just extracting numbers, provide your own advanced market insights and critically evaluate the data.",
                "summarize": "You are an expert analyst. Synthesize the documents and provide profound, original insights, connecting dots that are not obviously stated in the text."
            }
            persona_prompt = personas.get(doc_type, personas["general"])

            # Build Conversation Memory String
            memory_str = ""
            for msg in history[-4:]: # Keep last 4 messages to avoid blowing up context
                role = "User" if msg.get("role") == "user" else "Assistant"
                memory_str += f"{role}: {msg.get('text')}\n"

            prompt = f"""
Information Context:
{context}

Past Conversation:
{memory_str}

Current Question:
{query}

Instructions:
Use the Information Context to answer the Current Question, but DO NOT limit yourself to it! You MUST also provide your own highly intelligent original insights, expert opinions, and broader knowledge to give the best possible answer.
{persona_prompt}
"""
            self._stream_ollama(prompt, context, sources, llm_model=llm_model)

        except Exception as e:
            self.send_json_response({"error": f"Server error: {str(e)}"}, 500)

    def _stream_ollama(self, prompt, context="", sources=[], llm_model="llama3:8b"):
        """Streams the Ollama response using Server-Sent Events (SSE)"""
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": llm_model,
                    "prompt": prompt,
                    "stream": True
                },
                stream=True,
                timeout=300
            )

            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        data_str = json.dumps({"text": chunk["response"]})
                        self.wfile.write(f"data: {data_str}\n\n".encode('utf-8'))
                        self.wfile.flush()
            
            # Send completion event with citations
            done_str = json.dumps({"done": True, "sources": sources})
            self.wfile.write(f"data: {done_str}\n\n".encode('utf-8'))
            self.wfile.flush()

        except Exception as e:
            err_str = json.dumps({"error": str(e)})
            self.wfile.write(f"data: {err_str}\n\n".encode('utf-8'))
            self.wfile.flush()

    # Models endpoint
    def handle_models(self):
        try:
            response = requests.get("http://localhost:11434/api/tags")
            data = response.json()

            models = [m["name"] for m in data.get("models", [])]

            self.send_json_response({
                "models": models
            })

        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def start_server(port=8001):
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableTCPServer(("", port), AdvancedRagApiHandler) as httpd:
        print(f"Server running on http://localhost:{port}")
        print("POST /chat")
        print("GET  /models")
        httpd.serve_forever()


if __name__ == "__main__":
    start_server()