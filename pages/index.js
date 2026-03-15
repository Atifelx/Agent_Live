// pages/index.js
// Main chat interface with document upload

import { useState, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
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
    setUploadProgress(10);
    setUploadStatus('Reading file...');

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        setUploadProgress(30);
        setUploadStatus('Uploading to server...');
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

        setUploadProgress(60);
        setUploadStatus('Contextual Chunking...');

        const data = await response.json();

        if (data.success) {
          setUploadProgress(90);
          setUploadStatus('Storing in Pinecone...');

          // Simulation for database confirmation
          setTimeout(() => {
            setUploadProgress(100);
            setUploadStatus('Completed!');
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(0);
              setUploadStatus('');
              alert(`✅ ${data.message}`);
            }, 800);
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
    if (!confirm('Are you sure you want to delete ALL data from the database? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        alert(`✅ ${data.message}`);
        setMessages([]); // Clear chat as well since context is gone
      } else {
        alert(`❌ Delete failed: ${data.error}`);
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
        const errorDetail = data.details ? `\n\nDetails: ${data.details}` : '';
        setMessages([
          ...newMessages,
          { role: 'assistant', content: `Error: ${data.error}${errorDetail}` },
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
              Powered by OpenRouter (NVIDIA Nemotron) + Pinecone Vector DB + LangChain
            </p>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">📤 Upload Documents</h2>

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
                  className={`block w-full text-center px-4 py-3 rounded-lg font-medium cursor-pointer transition ${uploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                    }`}
                >
                  {uploading ? '⏳ Processing...' : '📁 Choose File'}
                </label>

                {/* Progress Bar */}
                {uploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1 text-gray-600">
                      <span>{uploadStatus}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-3 text-center">
                  Supports PDF, TXT, DOCX (Max 50MB)
                </p>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="font-semibold mb-3 text-gray-800">🗑️ Manage Data</h3>
                  <button
                    onClick={handleDeleteData}
                    disabled={loading || uploading}
                    className="w-full px-4 py-2 border-2 border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <span>Clear All Documents</span>
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="font-semibold mb-3 text-gray-700">🧠 How It Works:</h3>
                  <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                    <li>Upload documents to vector DB</li>
                    <li>Ask specific questions</li>
                    <li>AI searches your context</li>
                    <li>Get sourced answers</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md flex flex-col h-[600px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                      <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        📖
                      </div>
                      <p className="text-lg font-medium text-gray-700">Ready to chat!</p>
                      <p className="mt-1">Upload a document to give the AI context.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border text-gray-800'
                            }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white border rounded-2xl px-4 py-3 shadow-sm">
                        <p className="text-gray-500 flex items-center">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1"></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t p-4 bg-white rounded-b-lg">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask about your documents..."
                      disabled={loading || uploading}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white"
                    />
                    <button
                      onClick={handleSend}
                      disabled={loading || !input.trim() || uploading}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center"
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
