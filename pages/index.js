// pages/index.js
// Main chat interface with document upload

import { useState, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];

        // Send to API
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContent: base64,
            fileName: file.name,
            fileType,
          }),
        });

        const data = await response.json();

        if (data.success) {
          alert(`✅ ${data.message}`);
        } else {
          alert(`❌ Upload failed: ${data.error}`);
        }

        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      alert(`Error: ${error.message}`);
      setUploading(false);
    }
  };

  // Handle chat
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      // Send to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatHistory: messages,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add AI response
        let aiMessage = data.answer;
        
        // Show tool usage
        if (data.usedTool) {
          aiMessage += `\n\n🔍 *Used DocumentSearch tool with query: "${data.toolQuery}"*`;
          if (data.sources && data.sources.length > 0) {
            aiMessage += `\n📚 Sources: ${data.sources.join(', ')}`;
          }
        }

        setMessages([...newMessages, { role: 'assistant', content: aiMessage }]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: `Error: ${data.error}` },
        ]);
      }
    } catch (error) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${error.message}` },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>RAG Chatbot - Agentic AI Demo</title>
        <meta name="description" content="RAG Chatbot with Agentic AI and Vector Database" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              🤖 RAG Chatbot - Agentic AI Demo
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Powered by Google Gemini + Pinecone Vector DB + LangChain
            </p>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-4">📤 Upload Documents</h2>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="file-upload"
                />
                
                <label
                  htmlFor="file-upload"
                  className={`block w-full text-center px-4 py-3 rounded-lg font-medium cursor-pointer transition ${
                    uploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {uploading ? '⏳ Uploading...' : '📁 Choose File'}
                </label>

                <p className="text-xs text-gray-500 mt-2 text-center">
                  Supports PDF, TXT, DOCX
                </p>

                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-3">🧠 How It Works:</h3>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li>1️⃣ Upload documents to vector DB</li>
                    <li>2️⃣ Ask questions</li>
                    <li>3️⃣ AI agent decides to search docs</li>
                    <li>4️⃣ Get answers with sources</li>
                  </ol>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-3">✅ Tech Stack:</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>🤖 Google Gemini (LLM)</li>
                    <li>📊 Pinecone (Vector DB)</li>
                    <li>🔗 LangChain (Framework)</li>
                    <li>⚡ Next.js + Vercel</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md flex flex-col h-[600px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                      <p className="text-lg">👋 Welcome!</p>
                      <p className="mt-2">Upload a document and start chatting</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-2">
                        <p className="text-gray-600">🤔 Thinking...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t p-4">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask anything about your documents..."
                      disabled={loading}
                      className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSend}
                      disabled={loading || !input.trim()}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
