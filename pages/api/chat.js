// pages/api/chat.js
// Agentic AI endpoint with dual-tool orchestration (Docs + Web)

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { tavily } from "@tavily/core";

// Initialize OpenRouter client
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/Atifelx/Agent_Live',
    'X-Title': 'Agent Live',
  },
});

const MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
];

function extractContent(message) {
  if (message.content && message.content.trim()) return message.content;
  if (message.reasoning && message.reasoning.trim()) return message.reasoning;
  return "";
}

function shortModelName(model) {
  return model.replace(':free', '').split('/').pop();
}

async function callWithFallback(params, onStream = () => {}, maxRetries = 2) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const model of MODELS) {
      try {
        const name = shortModelName(model);
        console.log(`[Attempt ${attempt + 1}] Trying model: ${model}`);
        onStream('model_try', name);
        const result = await openai.chat.completions.create({ ...params, model });
        if (params.stream) {
          onStream('model_ok', name);
          return result;
        }
        const msg = result.choices?.[0]?.message;
        const text = extractContent(msg || {});
        if (text) {
          if (!msg.content) msg.content = text;
          onStream('model_ok', name);
          return result;
        }
        console.log(`[${model}] Empty content, trying next model`);
        onStream('model_fail', `${name}|empty response`);
      } catch (err) {
        const name = shortModelName(model);
        const reason = err.message.length > 60 ? err.message.slice(0, 60) + '…' : err.message;
        console.log(`[${model}] Error: ${err.message}, trying next model`);
        onStream('model_fail', `${name}|${reason}`);
      }
    }
  }
  throw new Error('All models failed after retries');
}

/**
 * Tool 1: Vector Database Search
 */
async function searchDocuments(query) {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

    console.log('Knowledge Retrieval:', query);
    const embeddingResponse = await pinecone.inference.embed(
      'llama-text-embed-v2',
      [query],
      { inputType: 'query' }
    );

    if (!embeddingResponse?.data?.[0]) {
      throw new Error('Invalid embedding response');
    }
    const queryEmbedding = embeddingResponse.data[0].values;

    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 10,
      includeMetadata: true,
    });

    if (!searchResults.matches || searchResults.matches.length === 0) {
      return { success: false, message: 'No relevant documents found.' };
    }

    const results = searchResults.matches.map((match) => ({
      text: match.metadata.text,
      source: match.metadata.source,
      score: match.score,
    }));

    const uniqueResults = [];
    const seenTexts = new Set();
    for (const res of results) {
      const normalizedText = res.text.substring(0, 100).toLowerCase().replace(/\s/g, '');
      if (!seenTexts.has(normalizedText)) {
        uniqueResults.push(res);
        seenTexts.add(normalizedText);
      }
    }

    return {
      success: true,
      results: uniqueResults,
      context: uniqueResults.map(r => `[Source: ${r.source}] ${r.text}`).join('\n\n---\n\n'),
    };
  } catch (error) {
    console.error('Doc Search Error:', error);
    return { success: false, message: `Search error: ${error.message}` };
  }
}

/**
 * Tool 2: Tavily Web Search
 */
async function searchWeb(query) {
  try {
    console.log('Web Retrieval (Tavily):', query);
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

    const searchResult = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: 5,
      includeAnswer: true,
    });

    if (!searchResult.results || searchResult.results.length === 0) {
      return { success: false, message: 'No live web results found.' };
    }

    const context = searchResult.results.map(r =>
      `[Web Source: ${r.url}] (Title: ${r.title})\nSnippet: ${r.content}`
    ).join('\n\n---\n\n');

    return {
      success: true,
      context,
      sources: searchResult.results.map(r => r.url),
      tavilyAnswer: searchResult.answer
    };
  } catch (error) {
    console.error('Web Search Error:', error);
    return { success: false, message: `Web search failed: ${error.message}` };
  }
}

function smartRoute(userMessage, activeDocs) {
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();

  const greetingPattern = /^(hi|hello|hey|yo|sup|thanks|thank you|bye|good\s*(morning|evening|night)|how\s+are\s+you|what'?s\s+up|who\s+are\s+you|what\s+can\s+you\s+do|help)\b/i;
  if (greetingPattern.test(msg)) return 'direct';

  const webPatterns = [
    /\b(latest|current|recent|today|yesterday|this week|this month|breaking|trending|news)\b/i,
    /\b(what is|who is|where is)\b.*\b(right now|currently|in 202\d)\b/i,
    /\b(stock|price|weather|score|election|update)\b/i,
  ];
  if (webPatterns.some(p => p.test(msg))) return 'web';

  if (activeDocs.length > 0) {
    const docNames = activeDocs.map(d => d.toLowerCase());
    const docKeywords = docNames.flatMap(d =>
      d.replace(/\.pdf|\.txt|\.docx/g, '').split(/[-_,.\s]+/).filter(w => w.length > 2)
    );

    const docPatterns = [
      /\b(law|chapter|page|section|rule|principle|lesson)\s*\d/i,
      /\b(book|document|pdf|file|upload|summary|summarize|according\s+to)\b/i,
      /\b(what\s+does|what\s+is|explain|describe|tell\s+me\s+about|list)\b/i,
    ];

    if (docKeywords.some(kw => lower.includes(kw))) return 'rag';
    if (docPatterns.some(p => p.test(msg))) return 'rag';

    if (msg.endsWith('?') && msg.split(' ').length >= 3) return 'rag';
  }

  return 'direct';
}

const RAG_RELEVANCE_THRESHOLD = 0.3;

async function processWithAgent(userMessage, chatHistory = [], activeDocs = [], onStream = () => { }) {
  const libraryContext = activeDocs.length > 0
    ? `You have access to the user's private knowledge base containing: [${activeDocs.join(', ')}]. When context is provided from these documents, use it to answer accurately.`
    : "The user has no documents uploaded yet.";

  const route = smartRoute(userMessage, activeDocs);
  console.log(`[SMART ROUTE]: "${userMessage}" → ${route}`);

  onStream('stage', 'routing');

  let pipelineType = route;
  let accumulatedSources = [];
  let contextBlock = '';

  if (route === 'rag') {
    onStream('stage', 'rag');
    const docResult = await searchDocuments(userMessage);

    if (docResult.success && docResult.results.length > 0) {
      const topScore = docResult.results[0].score;
      console.log(`[RAG] Top score: ${topScore}`);

      if (topScore >= RAG_RELEVANCE_THRESHOLD) {
        contextBlock = docResult.context;
        accumulatedSources = docResult.results.map(r => r.source);
        pipelineType = 'rag';
      } else {
        console.log(`[RAG] Low relevance (${topScore}), falling back to web`);
        onStream('stage', 'web');
        const webResult = await searchWeb(userMessage);
        if (webResult.success) {
          contextBlock = webResult.context;
          accumulatedSources = webResult.sources || [];
          pipelineType = 'web';
        } else {
          pipelineType = 'direct';
        }
      }
    } else {
      console.log('[RAG] No results, falling back to web');
      onStream('stage', 'web');
      const webResult = await searchWeb(userMessage);
      if (webResult.success) {
        contextBlock = webResult.context;
        accumulatedSources = webResult.sources || [];
        pipelineType = 'web';
      } else {
        pipelineType = 'direct';
      }
    }
  } else if (route === 'web') {
    onStream('stage', 'web');
    const webResult = await searchWeb(userMessage);
    if (webResult.success) {
      contextBlock = webResult.context;
      accumulatedSources = webResult.sources || [];
      pipelineType = 'web';
    } else {
      pipelineType = 'direct';
    }
  }

  onStream('stage', 'generating');
  onStream('pipeline', pipelineType);
  onStream('sources', [...new Set(accumulatedSources)].join(','));

  const messages = [
    {
      role: 'system',
      content: `You are Clever Chat, a sophisticated AI research partner. ${libraryContext}

ALWAYS use rich markdown: bulleted (-) or numbered (1.) lists with bold key terms, proper headings, and clean newlines. Never write lists as a single paragraph. Be concise and helpful. Never repeat the same fact twice.`
    },
    ...chatHistory.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
  ];

  if (contextBlock) {
    messages.push({ role: 'user', content: userMessage });
    messages.push({
      role: 'assistant',
      content: `I found relevant information. Let me synthesize an answer.`
    });
    messages.push({
      role: 'user',
      content: `Here is the retrieved context:\n\n${contextBlock}\n\nUsing the context above, provide a clear, well-formatted answer to my question: "${userMessage}". Do NOT mention the search process or repeat raw data.`
    });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  try {
    const finalStream = await callWithFallback({
      messages,
      temperature: 0.5,
      presence_penalty: 0.4,
      frequency_penalty: 0.5,
      stream: true,
    }, onStream);

    let contentReceived = false;
    let reasoningBuffer = '';
    for await (const chunk of finalStream) {
      const delta = chunk.choices[0]?.delta || {};
      if (delta.content) {
        contentReceived = true;
        onStream('answer', delta.content);
      } else if (delta.reasoning) {
        reasoningBuffer += delta.reasoning;
      }
    }
    if (!contentReceived && reasoningBuffer) {
      const cleaned = reasoningBuffer.replace(/^[\s\S]*?(?=\n\n[A-Z]|\n\nHello|\n\nHi|\n\nHey)/m, '').trim();
      onStream('answer', cleaned || reasoningBuffer);
    }
  } catch (err) {
    onStream('answer', 'Sorry, all AI models are temporarily unavailable. Please try again.');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on this server.' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const { message, chatHistory, activeDocs } = req.body;
    if (!message) {
      res.write('ERR:Message required\n');
      return res.end();
    }

    await processWithAgent(message, chatHistory || [], activeDocs || [], (type, content) => {
      res.write(JSON.stringify({ type, content }) + '\n');
    });

    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.write(JSON.stringify({ type: 'err', content: error.message }) + '\n');
    res.end();
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};
