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

// Agentic AI: Multi-Tool Facilitator (Recursive Reasoning Loop)
async function processWithAgent(userMessage, chatHistory = [], activeDocs = []) {
  const libraryContext = activeDocs.length > 0
    ? `Currently active in your SECURE PRIVATE LIBRARY: [${activeDocs.join(', ')}].`
    : "Your private library is currently empty. Direct the user to upload documents if they ask about private files.";

  const systemPrompt = `You are Clever Chat, a sophisticated and empathetic AI research partner. Your goal is to help the user master complex information through multi-step reasoning.

${libraryContext}

You have access to TWO primary intelligence streams:
1. searchDocuments(query) - Search your SECURE PRIVATE LIBRARY. Use this for facts in specific uploaded files.
2. searchWeb(query) - Access the LIVE WORLD. Use this for current events, real-world examples, and facts beyond your library.

THINKING PROTOCOL:
1. **Analyze**: Break down the user's query. Do you need book facts? Do you need web examples?
2. **Execute**: If you need information, CALL A TOOL.
3. **Loop**: Review the tool results. Does this answer the whole question? If you need more info (e.g., now you need web examples for the book facts you found), CALL ANOTHER TOOL.
4. **Finalize**: Once you have ALL the pieces, synthesize a final human response.

YOUR VOICE:
- **Natural & Human**: Professional yet conversational.
- **Synthesis over Extraction**: Connect the dots across different search results.
- **No Technical Leaks**: NEVER show "TOOL:" or "QUERY:" in your final answer.

RESPONSE FORMAT:
- To use a tool, respond ONLY with: TOOL: <toolName> \n QUERY: <searchQuery>
- To give the final answer, respond with your natural synthesis.`;

  let currentMessages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  let turns = 0;
  const maxTurns = 4;
  let finalResult = { answer: "I'm having trouble reasoning through that. Could you rephrase?", usedTool: false };

  while (turns < maxTurns) {
    turns++;
    console.log(`--- Reasoning Turn ${turns} ---`);

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: currentMessages,
      temperature: 0.1,
    });

    const agentResponse = response.choices[0].message.content;
    console.log(`Agent Thought: ${agentResponse.substring(0, 100)}...`);

    // Enhanced Tool Detection
    let toolName = null;
    let searchQuery = null;

    const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/i);
    const queryMatch = agentResponse.match(/QUERY:\s*(.+)/i);

    if (toolMatch && queryMatch) {
      toolName = toolMatch[1].trim();
      searchQuery = queryMatch[1].trim();
    } else {
      // Fallback: Check for JSON-style calls
      try {
        const jsonMatch = agentResponse.match(/\{[\s\S]*"tool"[\s\S]*"query"[\s\S]*\}/);
        if (jsonMatch) {
          const potentialJson = JSON.parse(jsonMatch[0]);
          if (potentialJson.tool && potentialJson.query) {
            toolName = potentialJson.tool;
            searchQuery = potentialJson.query;
          }
        }
      } catch (e) { }
    }

    if (toolName && searchQuery) {
      console.log(`Executing Tool: ${toolName} | Query: ${searchQuery}`);
      let toolResult = null;
      if (toolName === 'searchDocuments') {
        toolResult = await searchDocuments(searchQuery);
      } else if (toolName === 'searchWeb' || toolName === 'searchTavily') {
        toolResult = await searchWeb(searchQuery);
      }

      if (toolResult && toolResult.success) {
        // Add thought and observation to history
        currentMessages.push({ role: 'assistant', content: agentResponse });
        currentMessages.push({
          role: 'user',
          content: `OBSERVATION from ${toolName}:\n${toolResult.context}\n\nDoes this complete the user's request? If you need another step (e.g. web search for examples), perform it now. Otherwise, give the final answer.`
        });

        // Track stats for the final return
        finalResult.usedTool = true;
        finalResult.toolName = toolName;
        finalResult.toolQuery = searchQuery;
        if (toolResult.results) {
          finalResult.sources = [...(finalResult.sources || []), ...toolResult.results.map(r => r.source)];
        } else if (toolResult.sources) {
          finalResult.sources = [...(finalResult.sources || []), ...toolResult.sources];
        }
      } else {
        currentMessages.push({ role: 'assistant', content: agentResponse });
        currentMessages.push({ role: 'user', content: `Tool Error: ${toolResult?.message || 'Unknown error'}. Please try to answer with what you know or attempt a different search.` });
      }
    } else {
      // No tool call -> Final Human Answer
      let finalAnswer = agentResponse;

      // Ironclad Technical Cleanup
      finalAnswer = finalAnswer
        .replace(/\{[\s\S]*"tool"[\s\S]*"query"[\s\S]*\}/gi, '')
        .replace(/TOOL:\s*\w+/gi, '')
        .replace(/QUERY:\s*.+/gi, '')
        .replace(/OBSERVATION from [\s\S]*?:/gi, '')
        .trim();

      return {
        ...finalResult,
        answer: finalAnswer,
      };
    }
  }

  return finalResult;
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
