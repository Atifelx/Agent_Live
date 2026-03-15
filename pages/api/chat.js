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

// Using NVIDIA Nemotron 3 Super (free)
const CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

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

    return {
      success: true,
      results,
      context: results.map(r => `[Source: ${r.source}] ${r.text}`).join('\n\n---\n\n'),
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

    // Perform search with context for LLM
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

// Agentic AI: Multi-Tool Facilitator
async function processWithAgent(userMessage, chatHistory = [], activeDocs = []) {
  const libraryContext = activeDocs.length > 0
    ? `Currently active in your SECURE PRIVATE LIBRARY: [${activeDocs.join(', ')}].`
    : "Your private library is currently empty. Direct the user to upload documents if they ask about private files.";

  const systemPrompt = `You are Clever Chat, a sophisticated and empathetic AI research partner. Your goal is to help the user master complex information through insightful conversation.

${libraryContext}

You have access to TWO primary intelligence streams:
1. searchDocuments(query) - Search your SECURE PRIVATE LIBRARY. Use this for deep-dives into the user's specific uploaded files listed above.
2. searchWeb(query) - Access the LIVE WORLD. Use this for real-time data, current events, and general facts beyond your private library.

YOUR VOICE:
- **Natural & Human**: Respond like a high-level advisor. Use a professional yet conversational tone.
- **Synthesis over Extraction**: Do not just quote text. Read the search results, understand the core lesson, and explain it clearly in your own words.
- **Engaging**: Acknowledge the user's intent or curiosity before presenting data.
- **Clean Output**: NEVER use robotic prefixes like "Based on the context provided..." Use natural transitions instead.

PROTOCOL:
- If a question is about the documents currently in your library, YOU MUST USE searchDocuments.
- For current pricing, news, or general live facts, USE searchWeb.
- Respond ONLY with the TOOL/QUERY block if a search is needed. Once you have data, provide your final response.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  // Pass 1: Reasoning
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: messages,
    temperature: 0.1,
  });

  let agentResponse = response.choices[0].message.content;

  // Tool Detection
  const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/);
  const queryMatch = agentResponse.match(/QUERY:\s*(.+)/);

  if (toolMatch && queryMatch) {
    const toolName = toolMatch[1].trim();
    const searchQuery = queryMatch[1].trim();
    let toolResult = null;

    if (toolName === 'searchDocuments') {
      toolResult = await searchDocuments(searchQuery);
    } else if (toolName === 'searchWeb') {
      toolResult = await searchWeb(searchQuery);
    }

    if (toolResult && toolResult.success) {
      const toolObservation = toolResult.context;

      const finalPrompt = `INTELLIGENCE STREAM DATA:
${toolObservation}

${toolResult.tavilyAnswer ? `WEB SUMMARY: ${toolResult.tavilyAnswer}\n` : ''}

INSTRUCTIONS FOR AURA:
1. **Synthesize & Discuss**: Do not simply repeat the snippets. Connect the dots and explain the answer naturally as if you've mastered the material yourself.
2. **Direct Answer**: Address the user's specific curiosity first.
3. **Natural Citations**: Integrate citations naturally into your flow (e.g., "(as highlighted in ${toolResult.sources?.[0] || 'the documents'})").
4. **NO ROBOTIC PREFIXES**: Avoid "According to the context" or "Based on my search." Just start the conversation.

User Inquiry: "${userMessage}"`;

      const finalResponse = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          ...messages,
          { role: 'assistant', content: agentResponse },
          { role: 'user', content: finalPrompt }
        ],
      });

      let finalAnswer = finalResponse.choices[0].message.content;
      // Cleanup leaks
      finalAnswer = finalAnswer.replace(/TOOL:\s*\w+/gi, '').replace(/QUERY:\s*.+/gi, '').trim();

      return {
        answer: finalAnswer,
        usedTool: true,
        toolName,
        toolQuery: searchQuery,
        sources: toolResult.sources || (toolResult.results ? toolResult.results.map(r => r.source) : []),
      };
    } else {
      return {
        answer: toolResult?.message || "I couldn't retrieve information for that request.",
        usedTool: true,
        toolName,
        toolQuery: searchQuery
      };
    }
  }

  // Direct Answer (General conversation)
  return {
    answer: agentResponse,
    usedTool: false,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, chatHistory, activeDocs } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const result = await processWithAgent(message, chatHistory || [], activeDocs || []);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process message',
      details: error.error?.message || error.message,
    });
  }
}
