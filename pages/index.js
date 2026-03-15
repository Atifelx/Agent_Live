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
  History
} from "lucide-react";
import dynamic from 'next/dynamic';
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedDocs = localStorage.getItem('aura_indexed_docs');
    if (savedDocs) {
      setUploadedDocs(JSON.parse(savedDocs));
    }
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

  // Handle chat with real-time streaming thoughts
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    // Placeholder for assistant response
    const assistantIndex = newMessages.length;
    setMessages([...newMessages, {
      role: 'assistant',
      content: '',
      thinkingSteps: [],
      loadingThoughts: true
    }]);

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
      let accumulatedThoughts = [];
      let accumulatedSources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        lines.forEach(line => {
          if (line.startsWith('THOUGHT:')) {
            const thought = line.replace('THOUGHT:', '').trim();
            if (thought) {
              accumulatedThoughts.push(thought);
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantIndex] = { ...updated[assistantIndex], thinkingSteps: [...accumulatedThoughts] };
                return updated;
              });
            }
          } else if (line.startsWith('SOURCE:')) {
            const sourcesList = line.replace('SOURCE:', '').trim();
            if (sourcesList) {
              accumulatedSources = sourcesList.split(',').map(s => s.trim());
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantIndex] = { ...updated[assistantIndex], sources: accumulatedSources, usedTool: true };
                return updated;
              });
            }
          } else if (line.startsWith('ANSWER:')) {
            const content = line.replace('ANSWER:', '');
            accumulatedContent += content;
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantIndex] = {
                ...updated[assistantIndex],
                content: accumulatedContent,
                loadingThoughts: false
              };
              return updated;
            });
          } else if (line.startsWith('ERR:')) {
            const error = line.replace('ERR:', '').trim();
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantIndex] = { ...updated[assistantIndex], content: `System Error: ${error}`, loadingThoughts: false };
              return updated;
            });
          }
        });
      }
    } catch (error) {
      console.error('Streaming Error:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantIndex] = { ...updated[assistantIndex], content: `Critical Error: ${error.message}`, loadingThoughts: false };
        return updated;
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 selection:bg-zinc-700">
      <Head>
        <title>Clever Chat | Agentic AI</title>
      </Head>

      {/* Navigation */}
      <nav className="border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center shadow-lg shadow-white/5">
              <BrainCircuit className="w-6 h-6 text-zinc-900" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-white">Clever Chat</span>
              <span className="text-xs text-zinc-500 font-medium tracking-wide">
                Build by <a href="https://www.linkedin.com/in/atif-shaikh/" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">Atif Shaikh</a>
              </span>
            </div>
            <div className="hidden md:flex ml-6 pl-6 border-l border-zinc-800">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-600">
                Agentic AI | Langchain | RAG | Live Search Agents
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 text-sm" onClick={handleDeleteData}>
              <Trash2 className="w-5 h-5 mr-3" />
              Reset DB
            </Button>
            <Separator orientation="vertical" className="h-8 bg-zinc-800" />
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
              <span className="text-sm text-zinc-500 font-medium uppercase tracking-wider">System Live</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-8 py-10 h-[calc(100vh-81px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 h-full">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8 flex flex-col">
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
                <Badge className="bg-zinc-800/80 text-zinc-300 border-none font-bold text-[10px]">{uploadedDocs.length}</Badge>
              </div>

              <ScrollArea className="flex-1 bg-zinc-900/10 rounded-2xl border border-zinc-800/30">
                <div className="p-4 space-y-3">
                  {uploadedDocs.length === 0 ? (
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
            </div>

            <div className="space-y-5 px-3 pt-4 border-t border-zinc-800/30">
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
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-800/10 rounded-full blur-[160px] -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-900/5 rounded-full blur-[140px] -z-10 pointer-events-none" />

            <ScrollArea className="flex-1 p-8" ref={scrollRef}>
              <div className="max-w-4xl mx-auto space-y-10 pb-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center mt-40 space-y-6 opacity-30">
                    <div className="p-5 bg-zinc-900/40 rounded-3xl border border-zinc-800 shadow-inner group-hover:scale-110 transition-transform duration-500">
                      <BrainCircuit className="w-16 h-16 text-zinc-100" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-zinc-100 tracking-tight">Intelligence Ready</h3>
                      <p className="text-base text-zinc-500 font-medium mt-2">Awaiting document context or user inquiry.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out`}>
                      <div className={`max-w-[85%] space-y-4`}>

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
                          <div className={`px-7 py-5 rounded-[2rem] text-base leading-[1.6] shadow-2xl ${msg.role === 'user'
                            ? 'bg-zinc-100 text-zinc-900 font-semibold ml-16 shadow-white/5'
                            : 'bg-zinc-900/80 border border-zinc-800 text-zinc-100 mr-16 border-white/5'
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
            <div className="p-8 bg-[#0a0a0a]/80 backdrop-blur-2xl border-t border-zinc-800/50">
              <div className="max-w-4xl mx-auto flex items-center space-x-4">
                <div className="relative flex-1 group">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Analyze neural patterns and document context..."
                    disabled={loading || uploading}
                    className="h-16 bg-zinc-900/60 border-zinc-800 focus:border-zinc-400 focus:ring-0 rounded-2xl px-6 text-base transition-all placeholder:text-zinc-600"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center h-full pointer-events-none">
                    <span className="text-[11px] font-bold text-zinc-600 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800 shadow-inner tracking-widest group-focus-within:border-zinc-500 transition-colors">⌘ ENTER</span>
                  </div>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim() || uploading}
                  className="h-16 w-16 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-2xl transition-all active:scale-95"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                </Button>
              </div>
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
