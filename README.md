# 🤖 RAG Chatbot with Agentic AI - Vercel Deployment

A production-ready **RAG (Retrieval Augmented Generation)** chatbot deployed to **Vercel** for FREE!

## ✨ Features

- 🧠 **Agentic AI** - Intelligent agent decides when to search documents
- 📊 **Vector Database** - Pinecone for semantic document search  
- 🤖 **Google Gemini** - Free LLM for chat responses
- 🔗 **LangChain** - Framework for orchestration
- 📄 **Multi-Format Support** - PDF, DOCX, TXT uploads
- ⚡ **Serverless** - Scales automatically on Vercel
- 🆓 **100% FREE** - No paid services required!

## 🏗️ Tech Stack

| Component | Service | Cost |
|-----------|---------|------|
| **LLM** | Google Gemini 1.5 Flash | FREE |
| **Vector DB** | Pinecone (Free Tier) | FREE |
| **Embeddings** | Google Gemini Embeddings | FREE |
| **Framework** | LangChain + Next.js | FREE |
| **Hosting** | Vercel | FREE |

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/rag-agentic-chatbot)

### Prerequisites

1. **Google Gemini API Key** (FREE)
   - Get from: https://ai.google.dev/

2. **Pinecone Account** (FREE)
   - Sign up: https://www.pinecone.io/
   - Create index with **768 dimensions**

3. **Vercel Account** (FREE)
   - Sign up: https://vercel.com/

### Step-by-Step Deployment

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for complete instructions!

## 💻 Local Development

```bash
# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local

# Add your API keys to .env.local

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📝 Environment Variables

```env
GOOGLE_API_KEY=your_google_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=rag-chatbot
PINECONE_ENVIRONMENT=us-east-1-aws
```

## 🎯 How It Works

```
1. User uploads document (PDF/DOCX/TXT)
   ↓
2. Document split into chunks
   ↓
3. Embeddings generated (Google Gemini)
   ↓
4. Vectors stored in Pinecone
   ↓
5. User asks question
   ↓
6. Agent analyzes query
   ↓
7. Agent decides: Search docs or answer directly
   ↓
8. If search needed: Query → Embedding → Pinecone
   ↓
9. Relevant chunks retrieved
   ↓
10. LLM generates answer with sources
```

## 📁 Project Structure

```
rag-vercel-app/
├── pages/
│   ├── api/
│   │   ├── upload.js      # Document upload & vectorization
│   │   └── chat.js        # Agentic chat with tool use
│   ├── index.js           # Main chat UI
│   └── _app.js            # Next.js app wrapper
├── styles/
│   └── globals.css        # Tailwind CSS
├── package.json
├── .env.example
├── DEPLOYMENT_GUIDE.md    # Complete setup guide
└── README.md
```

## 🔧 API Endpoints

### POST /api/upload
Upload and process documents

**Request:**
```json
{
  "fileContent": "base64_encoded_file",
  "fileName": "document.pdf",
  "fileType": "pdf"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed 42 chunks from document.pdf",
  "chunks": 42
}
```

### POST /api/chat
Chat with agentic AI

**Request:**
```json
{
  "message": "What is the main topic of the document?",
  "chatHistory": []
}
```

**Response:**
```json
{
  "success": true,
  "answer": "The main topic is...",
  "usedTool": true,
  "toolQuery": "main topic document",
  "sources": ["document.pdf"]
}
```

## 🎨 Customization

### Change LLM Model
```javascript
// In pages/api/chat.js
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-pro'  // More capable, same FREE tier
});
```

### Adjust Chunk Size
```javascript
// In pages/api/upload.js
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,      // Larger chunks
  chunkOverlap: 300,    // More overlap
});
```

### Change Vector Search Results
```javascript
// In pages/api/chat.js
const searchResults = await index.query({
  topK: 5,  // Return top 5 instead of 4
  includeMetadata: true,
});
```

## 📊 Free Tier Limits

| Service | Limit | Recommendation |
|---------|-------|----------------|
| Google Gemini | 60 req/min | ~2,500 chats/day |
| Pinecone Free | 100K vectors | ~100 documents |
| Vercel | Unlimited hobby | Perfect for demos |

## 🐛 Troubleshooting

**Issue:** Embedding dimension mismatch  
**Fix:** Ensure Pinecone index has **768 dimensions**

**Issue:** Upload fails  
**Fix:** Check file size < 10MB and supported format

**Issue:** No search results  
**Fix:** Verify documents were uploaded successfully

## 📚 Resources

- [Google AI Studio](https://ai.google.dev/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [LangChain JS Docs](https://js.langchain.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)

## 🤝 Contributing

Contributions welcome! Feel free to:
- Add new features
- Improve UI/UX
- Fix bugs
- Enhance documentation

## 📄 License

MIT License - feel free to use for your projects!

---

Built with ❤️ using 100% free services

**Demo:** [Your Vercel URL here]
