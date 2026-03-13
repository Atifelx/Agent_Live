# 🚀 COMPLETE FREE DEPLOYMENT GUIDE
## Deploy RAG Chatbot with Agentic AI to Vercel (100% FREE)

---

## 📋 STEP-BY-STEP ACCOUNT CREATION

### ✅ Step 1: Google Gemini API (FREE LLM)

**Purpose:** AI model for chat responses  
**Cost:** FREE forever (60 requests/min)  
**No credit card required!**

1. Go to: **https://ai.google.dev/**
2. Click **"Get API Key"** button (top right)
3. Sign in with your Google account
4. Click **"Create API Key"**
5. Copy the key (starts with `AIza...`)
6. Save it for later ✅

---

### ✅ Step 2: Pinecone Vector Database (FREE)

**Purpose:** Store and search document embeddings  
**Cost:** FREE tier (1 index, 100K vectors, plenty for demos)  
**Credit card:** Optional (not required for free tier)

1. Go to: **https://www.pinecone.io/**
2. Click **"Start Free"** or **"Sign Up"**
3. Sign up with email or Google
4. **Create a new project:**
   - Click **"Create Project"** or use default project
   - Project name: anything you want

5. **Create an Index:**
   - Click **"Create Index"**
   - Index name: `rag-chatbot` (remember this!)
   - Dimensions: **768** (important! for Google embeddings)
   - Metric: **cosine**
   - Click **"Create Index"**

6. **Get your API Key:**
   - Go to **"API Keys"** in left sidebar
   - Copy your API key
   - Save it for later ✅

7. **Note your Environment:**
   - Usually auto-detected
   - Shows in dashboard (like `us-east-1-aws`)
   - Save it for later ✅

---

### ✅ Step 3: Vercel Account (FREE Hosting)

**Purpose:** Host your web app  
**Cost:** FREE for hobby projects (unlimited)  
**No credit card required!**

1. Go to: **https://vercel.com/**
2. Click **"Sign Up"**
3. Sign up with GitHub (recommended) or email
4. No further setup needed yet! ✅

---

### ✅ Step 4: GitHub Account (if you don't have one)

**Purpose:** Store your code for Vercel deployment  
**Cost:** FREE

1. Go to: **https://github.com/**
2. Sign up for free
3. Verify your email ✅

---

## 🛠️ DEPLOYMENT STEPS

### Step 1: Prepare Your Code

1. **Download/Clone this project:**
   ```bash
   # Option A: Download ZIP and extract
   # Option B: Clone repository
   git clone <your-repo-url>
   cd rag-vercel-app
   ```

2. **Create `.env.local` file:**
   ```bash
   cp .env.example .env.local
   ```

3. **Edit `.env.local` with your keys:**
   ```env
   GOOGLE_API_KEY=AIza...your_google_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_INDEX_NAME=rag-chatbot
   PINECONE_ENVIRONMENT=us-east-1-aws
   ```

---

### Step 2: Push to GitHub

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Repository name: `rag-agentic-chatbot`
   - Make it Public (for easy Vercel deployment)
   - Click **"Create repository"**

2. **Push your code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: RAG Chatbot"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/rag-agentic-chatbot.git
   git push -u origin main
   ```

---

### Step 3: Deploy to Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Click **"Add New"** → **"Project"**

2. **Import your GitHub repository:**
   - Click **"Import"** next to your `rag-agentic-chatbot` repo
   - If not showing, click **"Import Git Repository"** and connect GitHub

3. **Configure your project:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (leave as is)
   - Build Command: `npm run build` (auto-filled)
   
4. **Add Environment Variables:**
   Click **"Environment Variables"** and add these one by one:
   
   | Name | Value |
   |------|-------|
   | `GOOGLE_API_KEY` | Your Google API key |
   | `PINECONE_API_KEY` | Your Pinecone API key |
   | `PINECONE_INDEX_NAME` | `rag-chatbot` |
   | `PINECONE_ENVIRONMENT` | Your Pinecone environment |

5. **Click "Deploy"** 🚀

---

### Step 4: Wait for Deployment (2-3 minutes)

Vercel will:
- ✅ Install dependencies
- ✅ Build your Next.js app
- ✅ Deploy to global CDN
- ✅ Give you a live URL!

---

### Step 5: Test Your App! 🎉

1. **Open your deployed URL:**
   - Something like: `https://rag-agentic-chatbot-xxx.vercel.app`

2. **Test the workflow:**
   - Click "Choose File" and upload a PDF/TXT/DOCX
   - Wait for processing (~10-30 seconds)
   - Ask questions about the document
   - Watch the AI agent decide to use the search tool!

---

## 🎯 WHAT YOU'VE BUILT

### Architecture:
```
User uploads document
        ↓
Next.js API processes file
        ↓
Text split into chunks
        ↓
Google Gemini generates embeddings (FREE)
        ↓
Stored in Pinecone vector DB (FREE)
        ↓
User asks question
        ↓
Agentic AI decides to search docs
        ↓
Query embedding generated
        ↓
Pinecone finds relevant chunks
        ↓
Google Gemini generates answer (FREE)
        ↓
Response with sources shown to user!
```

### Features:
- ✅ **Agentic AI** - Agent decides when to search documents
- ✅ **Vector Database** - Semantic search through documents
- ✅ **LangChain Framework** - Orchestrates the workflow
- ✅ **Tool Use** - DocumentSearch tool for retrieval
- ✅ **Source Citations** - Shows which documents were used
- ✅ **Cloud Deployed** - Accessible from anywhere
- ✅ **100% FREE** - No costs!

---

## 🔧 TROUBLESHOOTING

### Issue: "Embedding dimension mismatch"
**Solution:** Make sure Pinecone index dimensions = **768**

### Issue: "API key invalid"
**Solution:** Double-check you copied the full API key (no spaces)

### Issue: "Build failed"
**Solution:** Check environment variables are set correctly in Vercel

### Issue: "No documents found"
**Solution:** 
1. Make sure you created the Pinecone index
2. Check index name matches in `.env`
3. Try uploading a document again

---

## 📊 FREE TIER LIMITS

| Service | Free Limit | Enough For |
|---------|------------|------------|
| **Google Gemini** | 60 req/min | ~2,500 chats/day |
| **Pinecone** | 100K vectors | ~100 documents |
| **Vercel** | Unlimited | ∞ hobby projects |

**Perfect for:**
- ✅ Demo applications
- ✅ Portfolio projects
- ✅ Learning AI/RAG
- ✅ Proof of concepts

---

## 🎓 NEXT STEPS

### Want to add more features?

1. **Web Search Tool:**
   - Add SerpAPI (100 free searches/month)
   - Let agent search the internet too!

2. **Better UI:**
   - Add markdown rendering
   - Show typing indicators
   - Add file preview

3. **More File Types:**
   - CSV files
   - Excel sheets
   - Images with OCR

4. **Authentication:**
   - Add login with NextAuth.js
   - Personal document storage

5. **Analytics:**
   - Track usage with Vercel Analytics (free)
   - See how people use your demo

---

## 🙋 NEED HELP?

- **Vercel Docs:** https://nextjs.org/docs
- **Pinecone Docs:** https://docs.pinecone.io/
- **LangChain Docs:** https://js.langchain.com/docs
- **Google AI Docs:** https://ai.google.dev/docs

---

## ✅ CHECKLIST SUMMARY

- [ ] Created Google Gemini API key
- [ ] Created Pinecone account + index (768 dimensions!)
- [ ] Created Vercel account
- [ ] Pushed code to GitHub
- [ ] Deployed to Vercel with environment variables
- [ ] Tested upload + chat functionality
- [ ] Shared your demo with the world! 🚀

**Congratulations! You've built a production-ready RAG chatbot with Agentic AI, completely FREE!** 🎉
