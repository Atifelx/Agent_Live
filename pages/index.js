import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Upload,
  Trash2,
  FileText,
  BrainCircuit,
  Search,
  CheckCircle2,
  Loader2,
  BookOpen,
  Sparkles
} from "lucide-react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, loading]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'docx'].includes(fileType)) {
      alert('Please upload PDF, TXT, or DOCX files only');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setUploadStatus('Reading file...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        setUploadProgress(30);
        setUploadStatus('Processing metadata...');
        const base64 = e.target.result.split(',')[1];

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContent: base64,
            fileName: file.name,
            fileType,
          }),
        });

        setUploadProgress(60);
        setUploadStatus('Neural Chunking...');

        const data = await response.json();

        if (data.success) {
          setUploadProgress(90);
          setUploadStatus('Indexing in Vector DB...');

          setTimeout(() => {
            setUploadProgress(100);
            setUploadStatus('Success!');
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(0);
              setUploadStatus('');
            }, 1000);
          }, 1000);
        } else {
          setUploading(false);
          setUploadProgress(0);
          setUploadStatus('');
          alert(`❌ Upload failed: ${data.error}`);
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      alert(`Error: ${error.message}`);
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
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
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // Handle chat
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, chatHistory: messages }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.answer,
          usedTool: data.usedTool,
          toolQuery: data.toolQuery,
          sources: data.sources
        }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: `Error: ${data.details || data.error}`
        }]);
      }
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${error.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 selection:bg-zinc-700">
      <Head>
        <title>Aura | Intelligent RAG</title>
      </Head>

      {/* Navigation */}
      <nav className="border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-zinc-900" />
            </div>
            <span className="text-xl font-bold tracking-tight">Aura</span>
            <Badge variant="outline" className="ml-2 border-zinc-800 text-zinc-400 text-[10px] uppercase tracking-widest">Enterprise</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100" onClick={handleDeleteData}>
              <Trash2 className="w-4 h-4 mr-2" />
              Reset DB
            </Button>
            <Separator orientation="vertical" className="h-6 bg-zinc-800" />
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">System Live</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-73px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-zinc-900/40 border-zinc-800/50 backdrop-blur-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Upload Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-all shadow-xl shadow-zinc-950/20"
                >
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {uploading ? 'Processing' : 'Index Document'}
                  </label>
                </Button>

                {uploading && (
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                      <span className="flex items-center">
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                        {uploadStatus}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1 bg-zinc-800" />
                  </div>
                )}

                <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-medium">
                  PDF • TXT • DOCX (MAX 50MB)
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4 px-2">
              <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">Architecture</h4>
              {[
                { icon: Search, label: "Vector Retrieval", desc: "Pinecone Inference" },
                { icon: Sparkles, label: "Neural Answer", desc: "NVIDIA Nemotron" },
                { icon: BookOpen, label: "RAG Pipeline", desc: "Sourcing Active" }
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-3 group">
                  <div className="p-2 bg-zinc-900/60 rounded-lg group-hover:bg-zinc-800 transition-colors">
                    <item.icon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-zinc-300">{item.label}</div>
                    <div className="text-[10px] text-zinc-600 font-medium">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Engine */}
          <Card className="lg:col-span-3 flex flex-col bg-zinc-900/20 border-zinc-800/50 overflow-hidden backdrop-blur-sm relative group">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/20 rounded-full blur-[120px] -z-10 pointer-events-none" />

            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="max-w-3xl mx-auto space-y-8 pb-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center mt-32 space-y-4 opacity-50">
                    <BrainCircuit className="w-12 h-12 text-zinc-700" />
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-zinc-300">Neural Engine Offline</h3>
                      <p className="text-sm text-zinc-500">Awaiting document context or user prompt.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                      <div className={`max-w-[85%] space-y-3`}>
                        <div className={`px-5 py-4 rounded-2xl text-[14px] leading-relaxed shadow-sm ${msg.role === 'user'
                            ? 'bg-zinc-100 text-zinc-900 font-medium ml-12'
                            : 'bg-zinc-900/80 border border-zinc-800 text-zinc-300 mr-12'
                          }`}>
                          {msg.content}
                        </div>

                        {msg.role === 'assistant' && msg.usedTool && (
                          <div className="flex flex-col space-y-2 ml-4">
                            <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                              <Search className="w-3 h-3" />
                              <span>Found relevant context in docs</span>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(msg.sources)).map((s, i) => (
                                  <Badge key={i} variant="outline" className="bg-zinc-950/50 border-zinc-800 text-[10px] text-zinc-400 capitalize">
                                    <FileText className="w-2.5 h-2.5 mr-1" />
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
                {loading && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl px-5 py-3 shadow-sm">
                      <div className="flex space-x-1.5">
                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Engine */}
            <div className="p-6 bg-[#0a0a0a]/50 backdrop-blur-xl border-t border-zinc-800/50">
              <div className="max-w-3xl mx-auto flex items-center space-x-3">
                <div className="relative flex-1 group">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Analyze document content..."
                    disabled={loading || uploading}
                    className="h-12 bg-zinc-900/50 border-zinc-800 focus:border-zinc-500 focus:ring-0 rounded-xl px-4 transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center h-full pointer-events-none">
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 group-focus-within:border-zinc-600 transition-colors">⌘ ENTER</span>
                  </div>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim() || uploading}
                  className="h-12 w-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-xl transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
