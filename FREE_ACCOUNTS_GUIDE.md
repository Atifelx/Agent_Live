# 🆓 FREE ACCOUNTS REQUIRED - QUICK REFERENCE

## ✅ Complete List of Free Accounts Needed

### 1️⃣ Google Gemini (AI Model)
- **Website:** https://ai.google.dev/
- **What to do:**
  1. Click "Get API Key"
  2. Sign in with Google
  3. Create API key
  4. Copy key (starts with `AIza...`)
- **Cost:** FREE forever
- **Credit card:** NOT required
- **Use:** AI responses and embeddings

---

### 2️⃣ Pinecone (Vector Database)
- **Website:** https://www.pinecone.io/
- **What to do:**
  1. Click "Start Free"
  2. Sign up with email
  3. Create an index:
     - Name: `rag-chatbot`
     - **Dimensions: 768** ⚠️ IMPORTANT!
     - Metric: cosine
  4. Go to API Keys
  5. Copy API key
  6. Note your environment (e.g., `us-east-1-aws`)
- **Cost:** FREE tier (100K vectors)
- **Credit card:** Optional (not needed for free)
- **Use:** Store document embeddings

---

### 3️⃣ Vercel (Web Hosting)
- **Website:** https://vercel.com/
- **What to do:**
  1. Click "Sign Up"
  2. Sign up with GitHub (recommended)
  3. That's it! Deploy later.
- **Cost:** FREE for hobby projects
- **Credit card:** NOT required
- **Use:** Host your web app

---

### 4️⃣ GitHub (Code Storage)
- **Website:** https://github.com/
- **What to do:**
  1. Sign up (if you don't have account)
  2. Create new repository for your code
- **Cost:** FREE
- **Credit card:** NOT required
- **Use:** Store code for Vercel deployment

---

## 📋 INFORMATION TO SAVE

After creating accounts, save these:

| Information | Where to Find | Example |
|-------------|---------------|---------|
| Google API Key | Google AI Studio → API Keys | `AIzaSy...` |
| Pinecone API Key | Pinecone → API Keys | `pcsk_...` |
| Pinecone Index Name | What you named it | `rag-chatbot` |
| Pinecone Environment | Pinecone Dashboard | `us-east-1-aws` |

---

## ⚡ QUICK START CHECKLIST

- [ ] 1. Create Google Gemini account → Get API key
- [ ] 2. Create Pinecone account → Create index (768 dims!) → Get API key
- [ ] 3. Create Vercel account
- [ ] 4. Create GitHub account (or use existing)
- [ ] 5. Clone/download the project code
- [ ] 6. Create `.env.local` with your keys
- [ ] 7. Push code to GitHub
- [ ] 8. Deploy on Vercel with environment variables
- [ ] 9. Test your live demo! 🎉

---

## 💡 TOTAL COST

**$0.00** - Everything is 100% FREE! ✅

No credit card required for:
- ✅ Google Gemini
- ✅ Vercel  
- ✅ GitHub

Optional (but not needed for free tier):
- ⚠️ Pinecone may ask, but free tier works without

---

## 🎯 WHAT YOU GET

With these FREE accounts, you can:
- ✅ Upload documents (PDF, DOCX, TXT)
- ✅ Store up to 100K vector embeddings
- ✅ Handle ~2,500 chat messages per day
- ✅ Deploy unlimited hobby projects
- ✅ Share with the world via public URL
- ✅ Perfect demo for interviews/portfolio!

---

## ⏱️ TOTAL TIME TO SETUP

- Account creation: 10-15 minutes
- Code deployment: 5 minutes  
- **Total: ~20 minutes** to go from zero to live demo!

---

## 🚨 IMPORTANT NOTES

### Pinecone Index Dimensions
**MUST BE 768** for Google Gemini embeddings!
- ❌ Wrong: 1536, 512, 384
- ✅ Correct: 768

### Environment Variables in Vercel
Make sure to add ALL 4 variables:
1. `GOOGLE_API_KEY`
2. `PINECONE_API_KEY`
3. `PINECONE_INDEX_NAME`
4. `PINECONE_ENVIRONMENT`

### Free Tier Limits
- Google Gemini: 60 requests/minute
- Pinecone: 100,000 vectors
- Vercel: Unlimited hobby projects

**All perfect for demos and learning!**
