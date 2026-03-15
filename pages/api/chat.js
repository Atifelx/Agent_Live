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

// Tool: Vector Database Search
async function searchDocuments(query) {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

    // Generate embedding for query via Pinecone Inference
    // MUST match the model used when indexing documents (llama-text-embed-v2)
    console.log('Generating embedding for query using Pinecone:', query);
    const embeddingResponse = await pinecone.inference.embed(
      'llama-text-embed-v2',
      [query],
      { inputType: 'query' }
    );

    if (!embeddingResponse || !embeddingResponse.data || !embeddingResponse.data[0]) {
      throw new Error(`Invalid embedding response: ${JSON.stringify(embeddingResponse)}`);
    }
    const queryEmbedding = embeddingResponse.data[0].values; // Pinecone returns 'values'

    // Search in Pinecone
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 10, // Increased for better recall
      includeMetadata: true,
    });

    if (!searchResults.matches || searchResults.matches.length === 0) {
      return {
        success: false,
        message: 'No relevant documents found.',
      };
    }

    // Format results
    const results = searchResults.matches.map((match) => ({
      text: match.metadata.text,
      source: match.metadata.source,
      score: match.score,
    }));

    console.log(`Knowledge Search: Found ${results.length} matches. Best score: ${results[0]?.score}`);

    return {
      success: true,
      results,
      context: results.map(r => r.text).join('\n\n---\n\n'),
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
  const systemPrompt = `You are Aura, an elite AI research assistant.
You have access to a secure document database.

AVAILABLE TOOLS:
1. searchDocuments(query) - Search through uploaded documents. Use this for specific names (e.g., "Mr. Edison"), concepts, or details from the books.

PROTOCOL:
- If the user asks about specific content, YOU MUST SEARCH FIRST.
- To use the tool, respond ONLY with:
TOOL: searchDocuments
QUERY: <search query>

- Once you have the results, provide a professional, natural answer.
- DO NOT mention the word "TOOL" or "QUERY" in your final response to the user.
- Cite the source files (e.g., "According to [Filename]...")`;

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
    temperature: 0, // Lower temperature for more consistent tool calling
  });

  let agentResponse = response.choices[0].message.content;

  // Check if agent wants to use tool
  if (agentResponse.includes('TOOL: searchDocuments')) {
    const queryMatch = agentResponse.match(/QUERY:\s*(.+)/);
    if (queryMatch) {
      const searchQuery = queryMatch[1].trim();

      // Use tool
      const searchResult = await searchDocuments(searchQuery);

      if (searchResult.success) {
        const contextPrompt = `NEURAL SEARCH RESULTS:
${searchResult.context}

INSTRUCTIONS:
- Answer the user's question accurately using ONLY the context above.
- If the information is not in the context, say you don't know based on the documents.
- Use a natural, helpful tone. 
- DO NOT repeat the "TOOL:" or "QUERY:" headers in your answer.

User Question: "${userMessage}"`;

        const finalResponse = await openai.chat.completions.create({
          model: CHAT_MODEL,
          messages: [
            ...messages,
            { role: 'assistant', content: agentResponse },
            { role: 'user', content: contextPrompt }
          ],
        });

        let finalAnswer = finalResponse.choices[0].message.content;

        // Final cleanup: Ensure no leaked tool calls
        finalAnswer = finalAnswer.replace(/TOOL: searchDocuments/gi, '').replace(/QUERY: .+/gi, '').trim();

        return {
          answer: finalAnswer,
          usedTool: true,
          toolQuery: searchQuery,
          sources: searchResult.results.map(r => r.source),
        };
      } else {
        return {
          answer: "I couldn't find relevant information in the uploaded documents.",
          usedTool: true,
          toolQuery: searchQuery,
          sources: [],
        };
      }
    }
  }

  // No tool needed
  return {
    answer: agentResponse,
    usedTool: false,
  };
}

export default async function handler(req, res) {
  console.log('--- Chat API Request Received ---');
  const keyMatch = process.env.OPENROUTER_API_KEY ? `Key present, length: ${process.env.OPENROUTER_API_KEY.length}, starts with: ${process.env.OPENROUTER_API_KEY.substring(0, 10)}...` : 'Key MISSING';
  console.log('API Key Status:', keyMatch);

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
    // Extract specific error message if available (e.g. from OpenRouter/OpenAI client)
    const detailedMessage = error.error?.message || error.message || 'Unknown error';
    return res.status(500).json({
      success: false,
      error: 'Failed to process message',
      details: detailedMessage,
    });
  }
}
