// pages/api/chat.js
// Agentic AI endpoint with vector search tool using OpenRouter

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize OpenRouter client
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/Atifelx/Agent_Live', // Optional
    'X-Title': 'Agent Live', // Optional
  },
});

// Using NVIDIA Nemotron 3 Super (free) as requested
const CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
// Using Google Gemini Embedding 001 (free) for embeddings (768 dimensions)
const EMBEDDING_MODEL = 'google/gemini-embedding-001';

const initPinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pinecone.index(process.env.PINECONE_INDEX_NAME);
};

// Tool: Vector Database Search
async function searchDocuments(query) {
  try {
    const index = await initPinecone();

    // Generate embedding for query via OpenRouter
    console.log('Generating embedding for query:', query);
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      encoding_format: 'float', // Explicitly set to float
    });
    console.log('Embedding Response for query:', JSON.stringify(embeddingResponse, null, 2));

    if (!embeddingResponse || !embeddingResponse.data || !embeddingResponse.data[0]) {
      throw new Error(`Invalid embedding response: ${JSON.stringify(embeddingResponse)}`);
    }
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search in Pinecone
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 4,
      includeMetadata: true,
    });

    if (!searchResults.matches || searchResults.matches.length === 0) {
      return {
        success: false,
        message: 'No relevant documents found. Please upload documents first.',
      };
    }

    // Format results
    const results = searchResults.matches.map((match) => ({
      text: match.metadata.text,
      source: match.metadata.source,
      score: match.score,
    }));

    return {
      success: true,
      results,
      context: results.map(r => r.text).join('\n\n'),
    };

  } catch (error) {
    return {
      success: false,
      message: `Search error: ${error.message}`,
    };
  }
}

// Agentic AI: Decide when to use tools
async function processWithAgent(userMessage, chatHistory = []) {
  // System prompt for agentic behavior
  const systemPrompt = `You are an intelligent AI assistant with access to a document search tool.

AVAILABLE TOOLS:
1. searchDocuments(query) - Search through uploaded documents in the vector database

YOUR PROCESS:
1. Analyze the user's question
2. Decide if you need to search documents:
   - Use searchDocuments if the question is about specific uploaded content
   - Answer directly if it's general knowledge or conversation
3. If using searchDocuments, formulate a good search query
4. Provide a helpful answer based on the context

When you want to use a tool, respond EXACTLY in this format:
TOOL: searchDocuments
QUERY: <your search query here>

Otherwise, just provide your answer directly.`;

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  // First call: Decide if tool is needed
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: messages,
  });

  const agentResponse = response.choices[0].message.content;

  // Check if agent wants to use tool
  if (agentResponse.includes('TOOL: searchDocuments')) {
    // Extract query
    const queryMatch = agentResponse.match(/QUERY: (.+)/);
    if (queryMatch) {
      const searchQuery = queryMatch[1].trim();

      // Use tool
      const searchResult = await searchDocuments(searchQuery);

      if (searchResult.success) {
        // Second call: Answer with context
        const contextPrompt = `Based on these search results from the documents:

${searchResult.context}

Sources: ${searchResult.results.map(r => r.source).join(', ')}

Now answer the user's question: "${userMessage}"

Provide a helpful answer and cite the sources.`;

        const finalResponse = await openai.chat.completions.create({
          model: CHAT_MODEL,
          messages: [
            ...messages,
            { role: 'assistant', content: agentResponse },
            { role: 'user', content: contextPrompt }
          ],
        });

        return {
          answer: finalResponse.choices[0].message.content,
          usedTool: true,
          toolQuery: searchQuery,
          sources: searchResult.results.map(r => r.source),
        };
      } else {
        return {
          answer: searchResult.message,
          usedTool: true,
          toolQuery: searchQuery,
          sources: [],
        };
      }
    }
  }

  // No tool needed, return direct answer
  return {
    answer: agentResponse,
    usedTool: false,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatHistory } = req.body;
    console.log('Chat API Request:', { message, chatHistoryVisible: !!chatHistory });

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Process with agent
    const result = await processWithAgent(message, chatHistory || []);

    return res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: 'Failed to process message',
      details: error.message,
    });
  }
}
