"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  text: string;
  role: "user" | "bot";
  sources?: string[];
  timestamp: Date;
};

export default function Home() {
  const [query, setQuery] = useState("");
  
  // Initialize state from localStorage or default
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, date: Date}[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [docType, setDocType] = useState("general");
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("privyrag_messages");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Convert string dates back to Date objects
        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) { console.error("Could not parse messages") }
    }

    const savedFiles = localStorage.getItem("privyrag_files");
    if (savedFiles) {
      try {
        const parsed = JSON.parse(savedFiles);
        setUploadedFiles(parsed.map((f: any) => ({ ...f, date: new Date(f.date) })));
      } catch (e) { console.error("Could not parse files") }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem("privyrag_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("privyrag_files", JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const startNewChat = () => {
    setMessages([]);
  };

  const sendMessage = async (textToSend: string = query) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), text: textToSend, role: "user", timestamp: new Date() };
    const currentHistory = messages.map(m => ({ role: m.role, text: m.text }));
    
    setMessages(prev => [...prev, userMsg]);
    setQuery("");

    try {
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: botMsgId, text: "", role: "bot", timestamp: new Date() }]);

      const res = await fetch("http://localhost:8001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: textToSend, 
          doc_type: docType,
          history: currentHistory
        }),
      });

      if (!res.ok) throw new Error("Backend error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) throw new Error("No reader");

      let botText = "";
      let botSources: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                console.error(data.error);
                continue;
              }
              if (data.done) {
                botSources = data.sources || [];
              } else if (data.text) {
                botText += data.text;
                setMessages(prev => prev.map(m => 
                  m.id === botMsgId ? { ...m, text: botText } : m
                ));
              }
            } catch (e) {
              console.error("Error parsing SSE:", line, e);
            }
          }
        }
      }

      if (botSources.length > 0) {
        setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, sources: botSources } : m
        ));
      }
      setIsConnected(true);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Gosh, something went wrong connecting to the AI.", role: "bot", timestamp: new Date() }]);
      setIsConnected(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    const newlyUploaded: {name: string, date: Date}[] = [];

    for (const file of files) {
      if (file.type !== "text/plain" && file.type !== "application/pdf") {
        setToast({ message: `Skipped ${file.name} - Only .txt and .pdf supported`, type: "error" });
        continue;
      }

      let content = "";
      if (file.type === "application/pdf") {
         const reader = new FileReader();
         content = await new Promise<string>((resolve) => {
           reader.onload = (e) => resolve(e.target?.result as string);
           reader.readAsDataURL(file);
         });
      } else {
         content = await file.text();
      }

      try {
        const res = await fetch("http://localhost:8001/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content }),
        });

        if (res.ok) {
          successCount++;
          newlyUploaded.push({ name: file.name, date: new Date() });
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      } catch (err) {
        setToast({ message: `Failed to upload ${file.name}`, type: "error" });
      }
    }

    if (successCount > 0) {
      setUploadedFiles(prev => [...newlyUploaded.reverse(), ...prev]);
      setToast({ message: `Successfully uploaded ${successCount} document(s)`, type: "success" });
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearDocuments = async () => {
    if (!confirm("Are you sure you want to delete all uploaded documents from the knowledge base?")) return;
    
    try {
      const res = await fetch("http://localhost:8001/clear_docs", {
        method: "POST",
      });
      if (res.ok) {
        setUploadedFiles([]);
        setToast({ message: "Knowledge base cleared successfully", type: "success" });
      } else {
        throw new Error("Failed to clear documents");
      }
    } catch (err) {
      setToast({ message: "Failed to clear knowledge base", type: "error" });
    }
  };

  const deleteDocument = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
      const res = await fetch("http://localhost:8001/delete_doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (res.ok) {
        setUploadedFiles(prev => prev.filter(f => f.name !== filename));
        setToast({ message: `${filename} deleted`, type: "success" });
      } else {
        throw new Error("Failed to delete document");
      }
    } catch (err) {
      setToast({ message: "Failed to delete document", type: "error" });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-white font-sans overflow-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg backdrop-blur-md text-sm font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
          toast.type === "success" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30" : "bg-red-500/20 text-red-200 border border-red-500/30"
        }`}>
          {toast.message}
        </div>
      )}

      {/* SIDEBAR */}
      <div className={`flex flex-col border-r border-white/5 bg-slate-900/40 backdrop-blur-sm transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 sm:w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight whitespace-nowrap">PrivyRAG</h1>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-lg transition-colors text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>New Chat</span>
            </div>
            {messages.length > 0 && <span className="text-[10px] bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-400">{messages.length}</span>}
          </button>
        </div>

        {/* Uploaded Documents Section */}
        <div className="flex-1 overflow-y-auto p-4 pt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Knowledge Base</h2>
            {uploadedFiles.length > 0 && (
              <button 
                onClick={clearDocuments}
                className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            {uploadedFiles.length === 0 ? (
              <p className="text-xs text-slate-600 italic px-1">No documents uploaded yet.</p>
            ) : (
              uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/5 group">
                  <div className="flex items-start gap-3 min-w-0">
                    <svg className="w-5 h-5 text-slate-500 shrink-0 mt-0.5 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-slate-300 truncate font-medium">{file.name}</span>
                      <span className="text-[10px] text-slate-500">{formatDate(file.date)} • {formatTime(file.date)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteDocument(file.name)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                    title="Delete document"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navigation Bar */}
        <div className="px-4 py-3 backdrop-blur-xl bg-slate-900/40 border-b border-white/5 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-white/5 text-xs font-medium text-slate-300">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`}></div>
              {isConnected ? "Connected" : "Offline"}
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Persona Dropdown */}
            <select
              title="Select Document Agent"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-800/80 border border-white/10 rounded-lg text-xs sm:text-sm text-slate-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.65em_auto] bg-no-repeat bg-[position:right_0.60rem_center] transition-colors hover:bg-slate-700/80"
            >
              <option value="general">🧠 General Agent</option>
              <option value="legal">⚖️ Legal Agent</option>
              <option value="medical">🩺 Medical Agent</option>
              <option value="financial">📈 Financial Agent</option>
            </select>

            {/* Styled File Upload (Multiple) */}
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload} 
                accept=".txt,.pdf" 
                multiple
                className="hidden" 
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 transition-colors rounded-lg cursor-pointer text-sm font-medium"
              >
                {isUploading ? (
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                )}
                <span className="hidden sm:inline">Upload Docs</span>
              </label>
            </div>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4 mt-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10">
                <span className="text-3xl">🤖</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-white">How can I help you?</h2>
              <p className="text-slate-400 mb-8 max-w-md">
                Upload your TXT/PDF documents and ask me anything about them! Your chat history and files are saved securely in your browser.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* Bot Avatar */}
                    {message.role === "bot" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center self-end mb-1">
                        <span className="text-xs">🤖</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 min-w-0">
                      <div
                        className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm break-words ${
                          message.role === "user"
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm"
                            : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-sm"
                        } ${message.text === "..." ? "animate-pulse py-4" : ""}`}
                      >
                        {message.text === "..." ? (
                          <div className="flex gap-1.5 items-center h-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                          </div>
                        ) : (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.text}
                          </div>
                        )}
                      </div>
                      
                      {/* Source Citations */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-700/50">
                          <span className="text-[10px] text-slate-500 mr-1 flex items-center">Sources:</span>
                          {message.sources.map((src, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800/80 rounded text-slate-400 border border-slate-700/50 flex items-center gap-1">
                              📄 {src}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {message.text !== "..." && (
                        <span className={`text-[10px] text-slate-500 px-1 ${message.role === "user" ? "text-right" : "text-left"}`}>
                          {formatTime(message.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef}></div>
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md border-t border-white/5 relative z-20">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none rounded-full" />
            
            <div className="relative flex items-center bg-slate-900 border border-slate-700 rounded-full shadow-lg focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all p-1.5 min-h-[56px]">
              
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                className="flex-1 bg-transparent border-none px-5 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 min-w-0"
                placeholder="Ask a question..."
                autoFocus
              />
              
              <div className="flex items-center gap-2 pr-1 shrink-0">
                <span className="hidden sm:inline-block text-[10px] font-medium text-slate-500 uppercase tracking-widest pointer-events-none px-2">
                  Press Enter
                </span>
                <button
                  onClick={() => sendMessage()}
                  disabled={!query.trim()}
                  className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                    query.trim() 
                      ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20" 
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <svg className="w-4 h-4 translate-x-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}