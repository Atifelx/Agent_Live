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
  'poolside/laguna-xs-2.1:free',
  'thinkingmachines/inkling-small:free',
];

function extractContent(message) {
  if (message.content && message.content.trim()) return message.content;
  if (message.reasoning && message.reasoning.trim()) return message.reasoning;
  return "";
}

async function callWithFallback(params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const model of MODELS) {
      try {
        console.log(`[Attempt ${attempt + 1}] Trying model: ${model}`);
        const result = await openai.chat.completions.create({ ...params, model });
        if (params.stream) return result;
        const msg = result.choices?.[0]?.message;
        const text = extractContent(msg || {});
        if (text) {
          if (!msg.content) msg.content = text;
          return result;
        }
        console.log(`[${model}] Empty content, trying next model`);
      } catch (err) {
        console.log(`[${model}] Error: ${err.message}, trying next model`);
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

async function processWithAgent(userMessage, chatHistory = [], activeDocs = [], onStream = () => { }) {
  const libraryContext = activeDocs.length > 0
    ? `Currently active in your SECURE PRIVATE LIBRARY: [${activeDocs.join(', ')}].`
    : "Your private library is currently empty. Direct the user to upload documents if they ask about private files.";

  const systemPrompt = `You are Clever Chat, a sophisticated AI research partner.

${libraryContext}

You have access to TWO tools:
1. searchDocuments(query) - Search the PRIVATE LIBRARY for facts in uploaded files.
2. searchWeb(query) - Access the LIVE WEB for current events and real-world examples.

RULES:
- If the user asks about uploaded documents, use searchDocuments.
- If the user asks about general knowledge or current events, use searchWeb.
- For simple greetings ("hi", "hello", "how are you"), answer DIRECTLY without using any tool.
- To use a tool respond ONLY with: TOOL: <toolName>\nQUERY: <searchQuery>
- After getting tool results, synthesize a helpful, non-repetitive answer.
- ALWAYS use rich markdown. When listing items, ALWAYS format them as a beautiful bulleted (-) or numbered (1.) list with bold titles and newlines between items. Never write lists as a single paragraph.
- NEVER repeat the same fact twice.
- Follow the user's length constraints strictly.`;

  const routingMessages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  onStream('thought', 'Analyzing request...');

  const response = await callWithFallback({
    messages: routingMessages,
    temperature: 0.1,
    max_tokens: 256,
  });

  let agentResponse = response.choices[0].message.content || "";
  // Strip reasoning chain-of-thought prefixes from reasoning models
  const toolIdx = agentResponse.search(/TOOL:\s*\w+/i);
  if (toolIdx > 0) {
    agentResponse = agentResponse.substring(toolIdx);
  }
  console.log(`[ROUTING DECISION]: ${agentResponse}`);

  let toolName = null;
  let searchQuery = null;
  const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/i);
  const queryMatch = agentResponse.match(/QUERY:\s*(.+)/i);

  if (toolMatch && queryMatch) {
    toolName = toolMatch[1].trim();
    searchQuery = queryMatch[1].trim();
  }

  let finalMessages = [...routingMessages];
  let accumulatedSources = [];

  if (toolName && searchQuery) {
    onStream('thought', `Searching ${toolName === 'searchDocuments' ? 'private library' : 'live web'}...`);
    let toolResult = null;
    if (toolName === 'searchDocuments') {
      toolResult = await searchDocuments(searchQuery);
    } else if (toolName === 'searchWeb' || toolName === 'searchTavily') {
      toolResult = await searchWeb(searchQuery);
    }

    if (toolResult && toolResult.success) {
      finalMessages.push({ role: 'assistant', content: agentResponse });
      finalMessages.push({
        role: 'user',
        content: `TOOL RESULTS:\n${toolResult.context}\n\nNow provide the final answer to the user. Be concise and non-repetitive.`
      });

      if (toolResult.results) accumulatedSources.push(...toolResult.results.map(r => r.source));
      if (toolResult.sources) accumulatedSources.push(...toolResult.sources);
    } else {
      finalMessages.push({ role: 'assistant', content: agentResponse });
      finalMessages.push({ role: 'user', content: `Tool was unavailable. Answer from your own knowledge.` });
    }
  } else {
    finalMessages.push({ role: 'assistant', content: agentResponse });
  }

  onStream('sources', [...new Set(accumulatedSources)].join(','));

  // Stream the final answer with fallback — try each model until one streams
  let streamed = false;
  for (const model of MODELS) {
    try {
      console.log(`[STREAM] Trying model: ${model}`);
      const finalStream = await openai.chat.completions.create({
        model,
        messages: [
          ...finalMessages,
          {
            role: 'system',
            content: "Provide your final answer. ALWAYS use rich markdown. When listing items, ALWAYS format them as a beautiful bulleted (-) or numbered (1.) list with bold key terms, proper headings, and clean newlines. Never write lists as a single paragraph."
          }
        ],
        temperature: 0.5,
        presence_penalty: 0.4,
        frequency_penalty: 0.5,
        stream: true,
      });

      for await (const chunk of finalStream) {
        const delta = chunk.choices[0]?.delta || {};
        if (delta.content) {
          onStream('answer', delta.content);
          streamed = true;
        }
      }
      if (streamed) break;
    } catch (err) {
      console.log(`[STREAM ${model}] Error: ${err.message}, trying next`);
    }
  }

  if (!streamed) {
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
