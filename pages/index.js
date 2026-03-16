import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  Send,
  Upload,
  Trash2,
  FileText,
  BrainCircuit,
  Search,
  CheckCircle2,
  ChevronRight,
  Loader2,
  BookOpen,
  Sparkles,
  Database,
  History,
  MessageSquare,
  Plus
} from "lucide-react";
import dynamic from 'next/dynamic';
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isFetchingDocs, setIsFetchingDocs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // Fetch existing indexed docs from Pinecone on mount
  useEffect(() => {
    const fetchIndexedDocs = async () => {
      try {
        const res = await fetch('/api/list-docs');
        const data = await res.json();
        if (data.success && data.sources.length > 0) {
          setUploadedDocs(data.sources);
          localStorage.setItem('aura_indexed_docs', JSON.stringify(data.sources));
        } else {
          // Fallback to localStorage if Pinecone returns empty
          const savedDocs = localStorage.getItem('aura_indexed_docs');
          if (savedDocs) setUploadedDocs(JSON.parse(savedDocs));
        }
      } catch (e) {
        // Fallback to localStorage on network error
        const savedDocs = localStorage.getItem('aura_indexed_docs');
        if (savedDocs) setUploadedDocs(JSON.parse(savedDocs));
      } finally {
        setIsFetchingDocs(false);
      }
    };
    fetchIndexedDocs();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, loading]);

  // Handle file upload (Async Robust Version)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'docx'].includes(fileType)) {
      alert('Please upload PDF, TXT, or DOCX files only');
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    setUploadStatus('Extracting Master Knowledge...');

    try {
      // Step 1: Extract and Chunk (Server-side helper)
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];

        const parseResponse = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileContent: base64, fileType }),
        });

        const parseData = await parseResponse.json();
        if (!parseData.success) throw new Error(parseData.error);

        const chunks = parseData.chunks;
        const batchSize = 70;
        const totalBatches = Math.ceil(chunks.length / batchSize);

        setUploadProgress(10);
        setUploadStatus(`Indexing ${chunks.length} semantic fragments...`);

        // Step 2: Sequential Batch Processing (Anti-Timeout & Anti-RateLimit)
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batchIndex = Math.floor(i / batchSize);
          const currentBatch = chunks.slice(i, i + batchSize);

          setUploadStatus(`Injection Pulse: ${batchIndex + 1} of ${totalBatches}`);

          const indexResponse = await fetch('/api/index-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batchTexts: currentBatch,
              fileName: file.name,
              startIndex: i
            }),
          });

          const indexData = await indexResponse.json();
          if (!indexData.success) throw new Error(indexData.error);

          // Update Progress
          const progress = 10 + Math.floor(((batchIndex + 1) / totalBatches) * 90);
          setUploadProgress(progress);

          // Rate-limit safety pause (Async Throttling)
          if (i + batchSize < chunks.length) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        setUploadStatus('Neural Sync Complete.');
        setUploadProgress(100);

        // Update UI
        setUploadedDocs(prev => {
          const updated = [...new Set([...prev, file.name])];
          localStorage.setItem('aura_indexed_docs', JSON.stringify(updated));
          return updated;
        });

        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          setUploadStatus('');
        }, 1500);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload Error:', error);
      alert(`Critical Error during Neural Sync: ${error.message}`);
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle delete data
  const handleDeleteData = async () => {
    if (!confirm('Are you sure you want to delete ALL data from the database?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/delete', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setMessages([{ role: 'assistant', content: "All documents cleared. I'm ready for new data." }]);
        setUploadedDocs([]);
        localStorage.removeItem('aura_indexed_docs');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const [sessionName, setSessionName] = useState('New Intelligence Session');
  const [mounted, setMounted] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedDocs = localStorage.getItem('aura_indexed_docs');
    if (savedDocs) setUploadedDocs(JSON.parse(savedDocs));

    const savedChat = localStorage.getItem('clever_chat_history');
    if (savedChat) {
      try {
        setMessages(JSON.parse(savedChat));
      } catch (e) {
        setMessages([{ role: 'assistant', content: "Neural session restored. How can I help you?" }]);
      }
    } else {
      setMessages([{ role: 'assistant', content: "Hello! I am Clever Chat. Upload a document to start our deep-dive, or ask me anything from the live web." }]);
    }

    const savedSessionName = localStorage.getItem('clever_chat_session_name');
    if (savedSessionName) {
      setSessionName(savedSessionName);
    }
  }, []);

  // Save history on change
  useEffect(() => {
    if (mounted && messages.length > 0) {
      localStorage.setItem('clever_chat_history', JSON.stringify(messages));
      localStorage.setItem('clever_chat_session_name', sessionName);
    }
  }, [messages, sessionName, mounted]);

  // Handle New Chat (Trigger Modal)
  const handleNewChat = () => {
    setShowResetModal(true);
  };

  // Execute New Chat after confirmation
  const executeNewChat = () => {
    setMessages([{ role: 'assistant', content: "New session started. How can I assist you?" }]);
    setSessionName('New Intelligence Session');
    localStorage.removeItem('clever_chat_history');
    localStorage.removeItem('clever_chat_session_name');
    setShowResetModal(false);
  };

  // Handle chat with real-time streaming thoughts
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Auto-generate session name if it's default
    if (sessionName === 'New Intelligence Session' || messages.length <= 1) {
      // Smarter naming: Get first few words or contextually clean up
      const cleanName = userMessage
        .replace(/[^\w\s]/gi, '')
        .split(' ')
        .slice(0, 5)
        .join(' ');

      const suggestedName = cleanName.length > 30 ? cleanName.substring(0, 30) + "..." : cleanName || "New Conversation";
      setSessionName(suggestedName);
    }

    // Atomic update: User msg + Assistant placeholder
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage },
      {
        role: 'assistant',
        content: '',
        thinkingSteps: ['Waking up intelligence engine...'],
        loadingThoughts: true
      }
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatHistory: messages,
          activeDocs: uploadedDocs
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let accumulatedThoughts = ['Waking up intelligence engine...'];
      let accumulatedSources = [];
      let streamBuffer = '';

      // Automated Thinking Pacer: Keeps the UI alive during long LLM waits
      const genericThoughts = [
        "Analyzing latent patterns...",
        "Cross-referencing verified knowledge...",
        "Synthesizing high-density context...",
        "Optimizing reasoning path...",
        "Finalizing intelligence output..."
      ];
      let thoughtIdx = 0;

      const thinkingTimer = setInterval(() => {
        if (accumulatedContent.length > 0) {
          clearInterval(thinkingTimer);
          return;
        }

        const nextThought = genericThoughts[thoughtIdx];
        if (nextThought && !accumulatedThoughts.includes(nextThought)) {
          accumulatedThoughts.push(nextThought);
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findLastIndex(m => m.role === 'assistant');
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], thinkingSteps: [...accumulatedThoughts] };
            }
            return updated;
          });
          thoughtIdx++;
        }
      }, 3000);

      const processLine = (line) => {
        if (!line.trim()) return;
        try {
          const data = JSON.parse(line);
          const { type, content } = data;

          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findLastIndex(m => m.role === 'assistant');
            if (idx === -1) return updated;

            if (type === 'thought') {
              if (!accumulatedThoughts.includes(content)) {
                accumulatedThoughts.push(content);
                updated[idx] = { ...updated[idx], thinkingSteps: [...accumulatedThoughts] };
              }
            } else if (type === 'sources') {
              accumulatedSources = content.split(',').map(s => s.trim());
              updated[idx] = { ...updated[idx], sources: accumulatedSources, usedTool: true };
            } else if (type === 'answer') {
              // Once actual answer starts, clear pacer
              clearInterval(thinkingTimer);
              accumulatedContent += content;
              updated[idx] = {
                ...updated[idx],
                content: accumulatedContent,
                loadingThoughts: false
              };
            } else if (type === 'err') {
              clearInterval(thinkingTimer);
              updated[idx] = { ...updated[idx], content: `System Error: ${content}`, loadingThoughts: false };
            }
            return updated;
          });
        } catch (e) {
          // Fragmented JSON, wait for next chunk
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      // Flush remaining buffer
      if (streamBuffer.trim()) {
        processLine(streamBuffer);
      }

      clearInterval(thinkingTimer);

    } catch (error) {
      console.error('Streaming Error:', error);
      setMessages(prev => {
        const updated = [...prev];
        const idx = updated.findLastIndex(m => m.role === 'assistant');
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], content: `Connection Error: ${error.message}`, loadingThoughts: false };
        }
        return updated;
      });
    }
    setLoading(false);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 selection:bg-zinc-700 overflow-x-hidden">
      <Head>
        <title>Clever Chat | Agentic AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Navigation */}
      <nav className="border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50 h-[65px] md:h-[73px]">
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mobile sidebar toggle */}
            <button
              className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center shadow-lg shadow-white/5">
              <BrainCircuit className="w-5 h-5 text-zinc-900" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-white">Clever Chat</span>
              <span className="text-xs text-zinc-500 font-medium tracking-wide hidden sm:block">
                Build by <a href="https://www.linkedin.com/in/atif-shaikh/" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">Atif Shaikh</a>
              </span>
            </div>
            <div className="hidden md:flex ml-4 pl-4 border-l border-zinc-800">
              <span className="text-[11px] uppercase tracking-[0.15em] font-bold text-white">
                Agentic AI | RAG | Live Search
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 text-xs md:text-sm px-2 md:px-3" onClick={handleDeleteData}>
              <Trash2 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Reset DB</span>
            </Button>
            <Separator orientation="vertical" className="h-8 bg-zinc-800 hidden md:block" />
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider hidden sm:block">Live</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      <main className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-4 h-[calc(100vh-65px)] md:h-[calc(100vh-73px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8 h-full">

          {/* Sidebar */}
          <div className={`
            fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
            w-72 lg:w-auto lg:col-span-1
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            bg-[#0a0a0a] lg:bg-transparent
            overflow-y-auto lg:overflow-visible
            pt-16 lg:pt-0
            px-4 lg:px-0
            space-y-6 md:space-y-8 flex flex-col
          `}>
            <Card className="bg-zinc-900/40 border-zinc-800/50 backdrop-blur-md p-2">
              <CardHeader className="pb-5">
                <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-widest flex items-center">
                  <Upload className="w-4 h-4 mr-2" />
                  Index New Source
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  asChild
                  disabled={uploading}
                  className="w-full h-14 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-all shadow-2xl shadow-zinc-950/40 text-base font-semibold rounded-xl"
                >
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5 mr-3" />}
                    {uploading ? 'Neural Processing' : 'Inject Context'}
                  </label>
                </Button>

                {uploading && (
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between text-xs font-semibold text-zinc-400">
                      <span className="flex items-center">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {uploadStatus}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5 bg-zinc-800" />
                  </div>
                )}

                <p className="text-xs text-zinc-500 text-center uppercase tracking-[0.15em] font-bold">
                  PDF • TXT • DOCX (MAX 50MB)
                </p>
              </CardContent>
            </Card>

            {/* Active Documents List */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-5 px-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center">
                  <History className="w-4 h-4 mr-2 text-zinc-500" />
                  Active Knowledge
                </h4>
                <div className="flex items-center gap-2">
                  {isFetchingDocs && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
                  <Badge className="bg-zinc-800/80 text-zinc-300 border-none font-bold text-[10px]">{uploadedDocs.length}</Badge>
                </div>
              </div>

              <ScrollArea className="flex-1 bg-zinc-900/10 rounded-2xl border border-zinc-800/30">
                <div className="p-4 space-y-3">
                  {isFetchingDocs ? (
                    <div className="py-10 text-center opacity-60">
                      <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-zinc-500" />
                      <p className="text-xs font-medium tracking-wide text-zinc-500">Scanning Knowledge Base...</p>
                    </div>
                  ) : uploadedDocs.length === 0 ? (
                    <div className="py-10 text-center opacity-30">
                      <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      <p className="text-xs font-medium tracking-wide">No Documents Indexed</p>
                    </div>
                  ) : (
                    uploadedDocs.map((doc, i) => (
                      <div key={i} className="flex items-center p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/40 group hover:border-zinc-700 transition-all animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="p-2 bg-zinc-950 rounded-lg mr-3 shadow-inner">
                          <FileText className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-200 truncate pr-2 tracking-tight">{doc}</p>
                          <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mt-0.5">Live In Vector DB</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Session Management UI */}
              <div className="mt-6 space-y-4 px-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center">
                    <MessageSquare className="w-3.5 h-3.5 mr-2 opacity-50" />
                    Neural Session
                  </h4>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                      onClick={handleNewChat}
                      title="Clear Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-full transition-all"
                      onClick={() => {
                        setMessages([{ role: 'assistant', content: "New session started. How can I assist you?" }]);
                        setSessionName('New Intelligence Session');
                      }}
                      title="New Chat"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl backdrop-blur-sm group hover:border-zinc-700/80 transition-all cursor-default">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-sm font-bold text-zinc-100 truncate tracking-tight group-hover:text-white transition-colors">
                      {sessionName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-3 pt-6 border-t border-zinc-800/30">
              <h4 className="text-xs font-bold text-zinc-600 uppercase tracking-[0.2em]">Infrastructure</h4>
              {[
                { icon: Search, label: "Vector Retrieval", desc: "Pinecone Inference (RAG)" },
                { icon: Sparkles, label: "Neural Answer", desc: "NVIDIA Nemotron 3" },
                { icon: BookOpen, label: "RAG Pipeline", desc: "Sourcing Active & Verified" }
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-4 group">
                  <div className="p-2.5 bg-zinc-900/60 rounded-xl group-hover:bg-zinc-800 transition-colors shadow-inner">
                    <item.icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                  </div>
                  <div className="pt-0.5">
                    <div className="text-sm font-bold text-zinc-300 tracking-tight">{item.label}</div>
                    <div className="text-xs text-zinc-600 font-semibold tracking-wide mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Engine */}
          <Card className="lg:col-span-3 flex flex-col bg-zinc-900/20 border-zinc-800/50 overflow-hidden backdrop-blur-sm relative group shadow-2xl shadow-black/80">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-zinc-800/10 rounded-full blur-[100px] md:blur-[160px] -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-indigo-900/5 rounded-full blur-[80px] md:blur-[140px] -z-10 pointer-events-none" />

            <ScrollArea className="flex-1 p-4 md:p-8" ref={scrollRef}>
              <div className="max-w-6xl mx-auto space-y-8 md:space-y-10 pb-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center mt-20 md:mt-40 space-y-6 opacity-30">
                    <div className="p-5 bg-zinc-900/40 rounded-3xl border border-zinc-800 shadow-inner">
                      <BrainCircuit className="w-12 h-12 md:w-16 md:h-16 text-zinc-100" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg md:text-xl font-bold text-zinc-100 tracking-tight">Intelligence Ready</h3>
                      <p className="text-sm md:text-base text-zinc-500 font-medium mt-2">Awaiting document context or user inquiry.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out`}>
                      <div className={`max-w-[98%] w-full space-y-4`}>

                        {/* Thinking Artifact (Real-time Reasoning) */}
                        {msg.role === 'assistant' && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 mb-2 backdrop-blur-sm shadow-xl border-white/5 animate-in zoom-in-95 duration-500">
                            <div className="flex items-center space-x-3 mb-4">
                              <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                                <BrainCircuit className="w-4 h-4 text-emerald-500 animate-pulse" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Agentic Reasoning Path</span>
                            </div>
                            <div className="space-y-3">
                              {msg.thinkingSteps.map((step, sIdx) => (
                                <div key={sIdx} className="flex items-start space-x-3 text-sm text-zinc-300 animate-in fade-in slide-in-from-left-2 duration-300">
                                  {sIdx === msg.thinkingSteps.length - 1 && msg.loadingThoughts ? (
                                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin mt-0.5" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                                  )}
                                  <span className={sIdx === msg.thinkingSteps.length - 1 && msg.loadingThoughts ? "text-zinc-100 font-medium" : "text-zinc-400"}>
                                    {step}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(msg.content || msg.role === 'user') && (
                          <div className={`px-8 py-4 rounded-[2rem] shadow-2xl ${msg.role === 'user'
                            ? 'bg-zinc-100 text-zinc-900 font-medium shadow-white/5'
                            : 'bg-zinc-900/80 border border-zinc-800 text-zinc-100 border-white/5'
                            }`}>
                            <div className="prose-aura">
                              <ReactMarkdown>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}

                        {msg.role === 'assistant' && msg.usedTool && (
                          <div className="flex flex-col space-y-3 ml-6 animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="flex items-center space-x-2 text-xs text-zinc-500 font-bold uppercase tracking-[0.2em]">
                              <Search className="w-4 h-4 text-emerald-500" />
                              <span>Verified Context Retrieval</span>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="flex flex-wrap gap-2.5">
                                {Array.from(new Set(msg.sources)).map((s, i) => (
                                  <Badge key={i} variant="outline" className="bg-zinc-900/80 border-zinc-700 text-xs text-zinc-400 capitalize py-1.5 px-4 rounded-xl shadow-inner font-bold tracking-tight">
                                    <FileText className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {/* Clean background loading state removed for Thinking Artifact */}
              </div>
            </ScrollArea>

            {/* Input Engine */}
            <div className="p-4 md:p-6 bg-[#0a0a0a]/80 backdrop-blur-2xl border-t border-zinc-800/50 mt-auto">
              <div className="max-w-6xl mx-auto flex items-center space-x-3 md:space-x-4">
                <div className="relative flex-1 group">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Analyze neural patterns and document context..."
                    disabled={loading || uploading}
                    className="h-14 md:h-16 bg-zinc-900/60 border-zinc-800 focus:border-zinc-400 focus:ring-0 rounded-2xl px-6 text-sm md:text-base transition-all placeholder:text-zinc-600"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center h-full pointer-events-none">
                    <span className="text-[10px] md:text-[11px] font-bold text-zinc-600 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800 shadow-inner tracking-widest group-focus-within:border-zinc-500 transition-colors hidden sm:block">⌘ ENTER</span>
                  </div>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim() || uploading}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-2xl transition-all active:scale-95 flex-shrink-0"
                >
                  {loading ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Send className="w-5 h-5 md:w-6 md:h-6" />}
                </Button>
              </div>
            </div>
          </Card>

        </div>
      </main>

      {/* Session Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowResetModal(false)} />
          <Card className="relative w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-transparent" />
            <CardHeader className="pt-8 px-6">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Clear Neural Session?</CardTitle>
              <CardDescription className="text-zinc-400 mt-2 text-sm leading-relaxed">
                This will purge all intelligence history and reset the current thinking path. This action is permanent.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-end space-x-3 pb-8 px-6 pt-4">
              <Button
                variant="ghost"
                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 shadow-lg shadow-red-900/20"
                onClick={executeNewChat}
              >
                Delete Session
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
