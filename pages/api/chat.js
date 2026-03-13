// pages/api/chat.js
// Agentic AI endpoint with vector search tool

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: 'embedding-001',
});

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
    
    // Generate embedding for query
    const queryEmbedding = await embeddings.embedQuery(query);
    
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

  // Build conversation
  const messages = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'I understand. I will analyze questions and use the searchDocuments tool when needed to find information from uploaded documents.' }] },
  ];

  // Add chat history
  chatHistory.forEach((msg) => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  });

  // Add current message
  messages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  // First call: Decide if tool is needed
  const chat = model.startChat({ history: messages.slice(0, -1) });
  const result = await chat.sendMessage(userMessage);
  const response = result.response.text();

  // Check if agent wants to use tool
  if (response.includes('TOOL: searchDocuments')) {
    // Extract query
    const queryMatch = response.match(/QUERY: (.+)/);
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

        const finalResult = await chat.sendMessage(contextPrompt);
        return {
          answer: finalResult.response.text(),
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
    answer: response,
    usedTool: false,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chatHistory } = req.body;

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
