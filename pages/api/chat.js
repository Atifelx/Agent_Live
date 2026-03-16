// // // pages/api/chat.js
// // // Agentic AI endpoint with dual-tool orchestration (Docs + Web)

// // import OpenAI from 'openai';
// // import { Pinecone } from '@pinecone-database/pinecone';
// // import { tavily } from "@tavily/core";

// // // Initialize OpenRouter client
// // const openai = new OpenAI({
// //   baseURL: 'https://openrouter.ai/api/v1',
// //   apiKey: process.env.OPENROUTER_API_KEY,
// //   defaultHeaders: {
// //     'HTTP-Referer': 'https://github.com/Atifelx/Agent_Live',
// //     'X-Title': 'Agent Live',
// //   },
// // });

// // // Using NVIDIA Nemotron 3 Super (free)
// // const CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

// // /**
// //  * Tool 1: Vector Database Search
// //  */
// // async function searchDocuments(query) {
// //   try {
// //     const pinecone = new Pinecone({
// //       apiKey: process.env.PINECONE_API_KEY,
// //     });
// //     const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

// //     console.log('Knowledge Retrieval:', query);
// //     const embeddingResponse = await pinecone.inference.embed(
// //       'llama-text-embed-v2',
// //       [query],
// //       { inputType: 'query' }
// //     );

// //     if (!embeddingResponse?.data?.[0]) {
// //       throw new Error('Invalid embedding response');
// //     }
// //     const queryEmbedding = embeddingResponse.data[0].values;

// //     const searchResults = await index.query({
// //       vector: queryEmbedding,
// //       topK: 10,
// //       includeMetadata: true,
// //     });

// //     if (!searchResults.matches || searchResults.matches.length === 0) {
// //       return { success: false, message: 'No relevant documents found.' };
// //     }

// //     const results = searchResults.matches.map((match) => ({
// //       text: match.metadata.text,
// //       source: match.metadata.source,
// //       score: match.score,
// //     }));

// //     // Deduplicate results based on text content to avoid LLM repetition
// //     const uniqueResults = [];
// //     const seenTexts = new Set();
// //     for (const res of results) {
// //       const normalizedText = res.text.substring(0, 100).toLowerCase().replace(/\s/g, '');
// //       if (!seenTexts.has(normalizedText)) {
// //         uniqueResults.push(res);
// //         seenTexts.add(normalizedText);
// //       }
// //     }

// //     return {
// //       success: true,
// //       results: uniqueResults,
// //       context: uniqueResults.map(r => `[Source: ${r.source}] ${r.text}`).join('\n\n---\n\n'),
// //     };
// //   } catch (error) {
// //     console.error('Doc Search Error:', error);
// //     return { success: false, message: `Search error: ${error.message}` };
// //   }
// // }

// // /**
// //  * Tool 2: Tavily Web Search
// //  */
// // async function searchWeb(query) {
// //   try {
// //     console.log('Web Retrieval (Tavily):', query);
// //     const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// //     // Perform search with context for LLM
// //     const searchResult = await tvly.search(query, {
// //       searchDepth: "advanced",
// //       maxResults: 5,
// //       includeAnswer: true,
// //     });

// //     if (!searchResult.results || searchResult.results.length === 0) {
// //       return { success: false, message: 'No live web results found.' };
// //     }

// //     const context = searchResult.results.map(r =>
// //       `[Web Source: ${r.url}] (Title: ${r.title})\nSnippet: ${r.content}`
// //     ).join('\n\n---\n\n');

// //     return {
// //       success: true,
// //       context,
// //       sources: searchResult.results.map(r => r.url),
// //       tavilyAnswer: searchResult.answer
// //     };
// //   } catch (error) {
// //     console.error('Web Search Error:', error);
// //     return { success: false, message: `Web search failed: ${error.message}` };
// //   }
// // }

// // // Two-model strategy: fast router + powerful synthesizer
// // // ROUTING_MODEL: Fast, cheap — decides if tool needed (must respond in <3s)
// // // CHAT_MODEL: Powerful — only used for the final answer stream
// // const ROUTING_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

// // // Agentic AI: Multi-Tool Facilitator (Recursive Reasoning Loop)
// // async function processWithAgent(userMessage, chatHistory = [], activeDocs = [], onStream = () => { }) {
// //   const libraryContext = activeDocs.length > 0
// //     ? `Currently active in your SECURE PRIVATE LIBRARY: [${activeDocs.join(', ')}].`
// //     : "Your private library is currently empty. Direct the user to upload documents if they ask about private files.";

// //   const systemPrompt = `You are Clever Chat, a sophisticated AI research partner.

// // ${libraryContext}

// // You have access to TWO tools:
// // 1. searchDocuments(query) - Search the PRIVATE LIBRARY for facts in uploaded files.
// // 2. searchWeb(query) - Access the LIVE WEB for current events and real-world examples.

// // RULES:
// // - If the user asks about uploaded documents, use searchDocuments.
// // - If the user asks about general knowledge or current events, use searchWeb.
// // - For simple greetings ("hi", "hello", "how are you"), answer DIRECTLY without using any tool.
// // - To use a tool respond ONLY with: TOOL: <toolName>\nQUERY: <searchQuery>
// // - After getting tool results, synthesize a helpful, non-repetitive answer.
// // - NEVER repeat the same fact twice.
// // - Follow the user's length constraints strictly.`;

// //   const routingMessages = [
// //     { role: 'system', content: systemPrompt },
// //     ...chatHistory.slice(-6).map(msg => ({ // Only last 6 messages for speed
// //       role: msg.role === 'user' ? 'user' : 'assistant',
// //       content: msg.content
// //     })),
// //     { role: 'user', content: userMessage }
// //   ];

// //   let currentMessages = [...routingMessages];
// //   let turns = 0;
// //   const maxTurns = 3; // Reduced from 4 to stay within timeout
// //   let accumulatedSources = [];

// //   onStream('thought', 'Analyzing your request...');

// //   while (turns < maxTurns) {
// //     turns++;

// //     // Use fast routing model for tool decision — critical for staying under Vercel timeout
// //     const response = await openai.chat.completions.create({
// //       model: ROUTING_MODEL,
// //       messages: currentMessages,
// //       temperature: 0.1,
// //       max_tokens: 200, // Only need a short tool-call or "answer directly"
// //     });

// //     const agentResponse = response.choices[0].message.content;

// //     // Tool Detection
// //     let toolName = null;
// //     let searchQuery = null;

// //     const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/i);
// //     const queryMatch = agentResponse.match(/QUERY:\s*(.+)/i);

// //     if (toolMatch && queryMatch) {
// //       toolName = toolMatch[1].trim();
// //       searchQuery = queryMatch[1].trim();
// //     }

// //     if (toolName && searchQuery) {
// //       const actionLabel = toolName === 'searchDocuments' ? 'Sifting through private library' : 'Scanning live web';
// //       onStream('thought', `${actionLabel}: "${searchQuery}"`);

// //       let toolResult = null;
// //       if (toolName === 'searchDocuments') {
// //         toolResult = await searchDocuments(searchQuery);
// //       } else if (toolName === 'searchWeb' || toolName === 'searchTavily') {
// //         toolResult = await searchWeb(searchQuery);
// //       }

// //       if (toolResult && toolResult.success) {
// //         currentMessages.push({ role: 'assistant', content: agentResponse });
// //         currentMessages.push({
// //           role: 'user',
// //           content: `TOOL RESULTS:\n${toolResult.context}\n\nNow provide the final answer to the user. Be concise and non-repetitive.`
// //         });

// //         if (toolResult.results) accumulatedSources.push(...toolResult.results.map(r => r.source));
// //         if (toolResult.sources) accumulatedSources.push(...toolResult.sources);
// //       } else {
// //         // Tool failed, answer from knowledge
// //         currentMessages.push({ role: 'assistant', content: agentResponse });
// //         currentMessages.push({ role: 'user', content: `Tool unavailable. Answer from your own knowledge.` });
// //       }
// //     } else {
// //       // No tool call → Stream final answer with the powerful model
// //       onStream('thought', 'Synthesizing response...');
// //       onStream('sources', [...new Set(accumulatedSources)].join(','));

// //       const finalStream = await openai.chat.completions.create({
// //         model: CHAT_MODEL,
// //         messages: [
// //           ...currentMessages,
// //           { role: 'system', content: "Provide your final answer. Be concise, accurate, and non-repetitive." }
// //         ],
// //         temperature: 0.5,
// //         presence_penalty: 0.4,
// //         frequency_penalty: 0.5,
// //         stream: true,
// //       });

// //       for await (const chunk of finalStream) {
// //         const content = chunk.choices[0]?.delta?.content || "";
// //         if (content) {
// //           onStream('answer', content);
// //         }
// //       }
// //       return;
// //     }
// //   }
// // }

// // export default async function handler(req, res) {
// //   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

// //   // Validate required env vars
// //   if (!process.env.OPENROUTER_API_KEY) {
// //     return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on this server.' });
// //   }

// //   // Set headers for streaming — compatible with Vercel serverless
// //   res.setHeader('Content-Type', 'text/plain; charset=utf-8');
// //   res.setHeader('Cache-Control', 'no-cache, no-transform');
// //   res.setHeader('Connection', 'keep-alive');
// //   res.setHeader('X-Accel-Buffering', 'no'); // Tells Vercel/nginx NOT to buffer the stream
// //   res.setHeader('Transfer-Encoding', 'chunked');

// //   try {
// //     const { message, chatHistory, activeDocs } = req.body;
// //     if (!message) {
// //       res.write('ERR:Message required\n');
// //       return res.end();
// //     }

// //     await processWithAgent(message, chatHistory || [], activeDocs || [], (type, content) => {
// //       res.write(JSON.stringify({ type, content }) + '\n');
// //     });

// //     res.end();
// //   } catch (error) {
// //     console.error('Chat error:', error);
// //     res.write(JSON.stringify({ type: 'err', content: error.message }) + '\n');
// //     res.end();
// //   }
// // }

// // // Per-route Next.js config: raise body limit and allow large streaming responses
// // export const config = {
// //   api: {
// //     bodyParser: {
// //       sizeLimit: '10mb',
// //     },
// //     responseLimit: false,
// //   },
// // };

// // // Helper: Delay for smoother AI "Thinking" visibility
// // const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));





// // pages/api/chat.js
// // Agentic AI endpoint with dual-tool orchestration (Docs + Web)


// //---------------------------------------------------------------------------------


// import OpenAI from 'openai';
// import { Pinecone } from '@pinecone-database/pinecone';
// import { tavily } from "@tavily/core";

// // Initialize OpenRouter client
// const openai = new OpenAI({
//   baseURL: 'https://openrouter.ai/api/v1',
//   apiKey: process.env.OPENROUTER_API_KEY,
//   defaultHeaders: {
//     'HTTP-Referer': 'https://github.com/Atifelx/Agent_Live',
//     'X-Title': 'Agent Live',
//   },
// });

// const MODEL_CONFIG = {
//   primary: 'nvidia/nemotron-3-super-120b-a12b:free',      // 🥇 Best RAG quality (120B)
//   fallback1: 'qwen/qwen-2.5-7b-instruct:free',            // 🥈 Balanced (7B)
//   fallback2: 'meta-llama/llama-3.2-3b-instruct:free',     // 🥉 Fast backup (3B)
// };


// // Use primary model for both chat and routing by default
// let CHAT_MODEL = MODEL_CONFIG.primary;
// let ROUTING_MODEL = MODEL_CONFIG.primary;

// /**
//  * Smart model caller with automatic fallback
//  */
// async function callModelWithFallback(messages, options = {}) {
//   const modelsToTry = [
//     MODEL_CONFIG.primary,
//     MODEL_CONFIG.fallback1,
//     MODEL_CONFIG.fallback2,
//   ];

//   for (let i = 0; i < modelsToTry.length; i++) {
//     const model = modelsToTry[i];
//     try {
//       console.log(`Attempting with model: ${model}`);

//       const response = await openai.chat.completions.create({
//         model: model,
//         messages: messages,
//         temperature: options.temperature || 0.5,
//         max_tokens: options.max_tokens || 1000,
//         stream: options.stream || false,
//         presence_penalty: options.presence_penalty || 0,
//         frequency_penalty: options.frequency_penalty || 0,
//       });

//       console.log(`✓ Success with model: ${model}`);

//       // Update active models if this one worked
//       if (i > 0) {
//         CHAT_MODEL = model;
//         ROUTING_MODEL = model;
//         console.log(`Switched to fallback model: ${model}`);
//       }

//       return response;
//     } catch (error) {
//       console.error(`✗ Model ${model} failed:`, error.message);

//       // If this was the last model, throw the error
//       if (i === modelsToTry.length - 1) {
//         throw new Error(`All models failed. Last error: ${error.message}`);
//       }

//       // Otherwise, try next model
//       console.log(`Trying fallback model ${i + 1}...`);
//     }
//   }
// }

// /**
//  * Tool 1: Vector Database Search
//  */
// async function searchDocuments(query) {
//   try {
//     const pinecone = new Pinecone({
//       apiKey: process.env.PINECONE_API_KEY,
//     });
//     const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

//     console.log('Knowledge Retrieval:', query);
//     const embeddingResponse = await pinecone.inference.embed(
//       'llama-text-embed-v2',
//       [query],
//       { inputType: 'query' }
//     );

//     if (!embeddingResponse?.data?.[0]) {
//       throw new Error('Invalid embedding response');
//     }
//     const queryEmbedding = embeddingResponse.data[0].values;

//     const searchResults = await index.query({
//       vector: queryEmbedding,
//       topK: 10,
//       includeMetadata: true,
//     });

//     if (!searchResults.matches || searchResults.matches.length === 0) {
//       return { success: false, message: 'No relevant documents found.' };
//     }

//     const results = searchResults.matches.map((match) => ({
//       text: match.metadata.text,
//       source: match.metadata.source,
//       score: match.score,
//     }));

//     // Deduplicate results based on text content to avoid LLM repetition
//     const uniqueResults = [];
//     const seenTexts = new Set();
//     for (const res of results) {
//       const normalizedText = res.text.substring(0, 100).toLowerCase().replace(/\s/g, '');
//       if (!seenTexts.has(normalizedText)) {
//         uniqueResults.push(res);
//         seenTexts.add(normalizedText);
//       }
//     }

//     return {
//       success: true,
//       results: uniqueResults,
//       context: uniqueResults.map(r => `[Source: ${r.source}] ${r.text}`).join('\n\n---\n\n'),
//     };
//   } catch (error) {
//     console.error('Doc Search Error:', error);
//     return { success: false, message: `Search error: ${error.message}` };
//   }
// }

// /**
//  * Tool 2: Tavily Web Search
//  */
// async function searchWeb(query) {
//   try {
//     console.log('Web Retrieval (Tavily):', query);
//     const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

//     // Perform search with context for LLM
//     const searchResult = await tvly.search(query, {
//       searchDepth: "advanced",
//       maxResults: 5,
//       includeAnswer: true,
//     });

//     if (!searchResult.results || searchResult.results.length === 0) {
//       return { success: false, message: 'No live web results found.' };
//     }

//     const context = searchResult.results.map(r =>
//       `[Web Source: ${r.url}] (Title: ${r.title})\nSnippet: ${r.content}`
//     ).join('\n\n---\n\n');

//     return {
//       success: true,
//       context,
//       sources: searchResult.results.map(r => r.url),
//       tavilyAnswer: searchResult.answer
//     };
//   } catch (error) {
//     console.error('Web Search Error:', error);
//     return { success: false, message: `Web search failed: ${error.message}` };
//   }
// }

// /**
//  * Agentic AI: Multi-Tool Facilitator (Recursive Reasoning Loop)
//  */
// async function processWithAgent(userMessage, chatHistory = [], activeDocs = [], onStream = () => { }) {
//   const libraryContext = activeDocs.length > 0
//     ? `Currently active in your SECURE PRIVATE LIBRARY: [${activeDocs.join(', ')}].`
//     : "Your private library is currently empty. Direct the user to upload documents if they ask about private files.";

//   const systemPrompt = `You are Clever Chat, a sophisticated AI research partner.

// ${libraryContext}

// You have access to TWO tools:
// 1. searchDocuments(query) - Search the PRIVATE LIBRARY for facts in uploaded files.
// 2. searchWeb(query) - Access the LIVE WEB for current events and real-world examples.

// RULES:
// - If the user asks about uploaded documents, use searchDocuments.
// - If the user asks about general knowledge or current events, use searchWeb.
// - For simple greetings ("hi", "hello", "how are you"), answer DIRECTLY without using any tool.
// - To use a tool respond ONLY with: TOOL: <toolName>\nQUERY: <searchQuery>
// - After getting tool results, synthesize a helpful, non-repetitive answer.
// - NEVER repeat the same fact twice.
// - Follow the user's length constraints strictly.`;

//   const routingMessages = [
//     { role: 'system', content: systemPrompt },
//     ...chatHistory.slice(-6).map(msg => ({ // Only last 6 messages for speed
//       role: msg.role === 'user' ? 'user' : 'assistant',
//       content: msg.content
//     })),
//     { role: 'user', content: userMessage }
//   ];

//   let currentMessages = [...routingMessages];
//   let turns = 0;
//   const maxTurns = 3; // Reduced from 4 to stay within timeout
//   let accumulatedSources = [];

//   onStream('thought', 'Analyzing your request...');

//   while (turns < maxTurns) {
//     turns++;

//     try {
//       // Use fast routing model for tool decision with automatic fallback
//       const response = await callModelWithFallback(currentMessages, {
//         temperature: 0.1,
//         max_tokens: 200, // Only need a short tool-call or "answer directly"
//       });

//       const agentResponse = response.choices[0].message.content;

//       // Tool Detection
//       let toolName = null;
//       let searchQuery = null;

//       const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/i);
//       const queryMatch = agentResponse.match(/QUERY:\s*(.+)/i);

//       if (toolMatch && queryMatch) {
//         toolName = toolMatch[1].trim();
//         searchQuery = queryMatch[1].trim();
//       }

//       if (toolName && searchQuery) {
//         const actionLabel = toolName === 'searchDocuments' ? 'Sifting through private library' : 'Scanning live web';
//         onStream('thought', `${actionLabel}: "${searchQuery}"`);

//         let toolResult = null;
//         if (toolName === 'searchDocuments') {
//           toolResult = await searchDocuments(searchQuery);
//         } else if (toolName === 'searchWeb' || toolName === 'searchTavily') {
//           toolResult = await searchWeb(searchQuery);
//         }

//         if (toolResult && toolResult.success) {
//           currentMessages.push({ role: 'assistant', content: agentResponse });
//           currentMessages.push({
//             role: 'user',
//             content: `TOOL RESULTS:\n${toolResult.context}\n\nNow provide the final answer to the user. Be concise and non-repetitive.`
//           });

//           if (toolResult.results) accumulatedSources.push(...toolResult.results.map(r => r.source));
//           if (toolResult.sources) accumulatedSources.push(...toolResult.sources);
//         } else {
//           // Tool failed, answer from knowledge
//           currentMessages.push({ role: 'assistant', content: agentResponse });
//           currentMessages.push({ role: 'user', content: `Tool unavailable. Answer from your own knowledge.` });
//         }
//       } else {
//         // No tool call → Stream final answer with the powerful model (with fallback)
//         onStream('thought', 'Synthesizing response...');
//         onStream('sources', [...new Set(accumulatedSources)].join(','));

//         const finalStream = await callModelWithFallback([
//           ...currentMessages,
//           { role: 'system', content: "Provide your final answer. Be concise, accurate, and non-repetitive." }
//         ], {
//           temperature: 0.5,
//           presence_penalty: 0.4,
//           frequency_penalty: 0.5,
//           stream: true,
//         });

//         for await (const chunk of finalStream) {
//           const content = chunk.choices[0]?.delta?.content || "";
//           if (content) {
//             onStream('answer', content);
//           }
//         }
//         return;
//       }
//     } catch (error) {
//       console.error('Agent processing error:', error);
//       onStream('thought', 'Encountering issues, retrying...');

//       // If all models failed after retries, send error and break
//       if (error.message.includes('All models failed')) {
//         onStream('answer', `I'm having trouble connecting to the AI models right now. Error: ${error.message}`);
//         return;
//       }
//     }
//   }

//   // Max turns reached without completion
//   onStream('answer', 'I apologize, but I need more time to process this request. Please try rephrasing your question.');
// }

// export default async function handler(req, res) {
//   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

//   // Validate required env vars
//   if (!process.env.OPENROUTER_API_KEY) {
//     return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on this server.' });
//   }

//   // Set headers for streaming — compatible with Vercel serverless
//   res.setHeader('Content-Type', 'text/plain; charset=utf-8');
//   res.setHeader('Cache-Control', 'no-cache, no-transform');
//   res.setHeader('Connection', 'keep-alive');
//   res.setHeader('X-Accel-Buffering', 'no'); // Tells Vercel/nginx NOT to buffer the stream
//   res.setHeader('Transfer-Encoding', 'chunked');

//   try {
//     const { message, chatHistory, activeDocs } = req.body;
//     if (!message) {
//       res.write('ERR:Message required\n');
//       return res.end();
//     }

//     await processWithAgent(message, chatHistory || [], activeDocs || [], (type, content) => {
//       res.write(JSON.stringify({ type, content }) + '\n');
//     });

//     res.end();
//   } catch (error) {
//     console.error('Chat error:', error);
//     res.write(JSON.stringify({ type: 'err', content: error.message }) + '\n');
//     res.end();
//   }
// }

// // Per-route Next.js config: raise body limit and allow large streaming responses
// export const config = {
//   api: {
//     bodyParser: {
//       sizeLimit: '10mb',
//     },
//     responseLimit: false,
//   },
// };

// // Helper: Delay for smoother AI "Thinking" visibility
// const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));




//=====================================================================

// pages/api/chat.js
// Agentic AI endpoint with dual-tool orchestration (Docs + Web)
// Multi-layer fallback: OpenRouter (3 models) → Google Gemini (ultimate backup)

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

// Model Configuration with Multi-Layer Fallback
// Layer 1: OpenRouter models (3 free models)
// Layer 2: Google Gemini (ultimate backup - always works)
const MODEL_CONFIG = {
  openrouter: {
    primary: 'nvidia/nemotron-3-super-120b-a12b:free',      // 🥇 Best RAG quality (120B)
    fallback1: 'qwen/qwen-2.5-7b-instruct:free',            // 🥈 Balanced (7B)
    fallback2: 'meta-llama/llama-3.2-3b-instruct:free',     // 🥉 Fast backup (3B)
  },
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY,                     // 🛡️ Ultimate fallback
    model: 'gemini-1.5-flash-latest',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
  }
};

// Track active model
let ACTIVE_MODEL = MODEL_CONFIG.openrouter.primary;
let USE_GEMINI_FALLBACK = false;

/**
 * Call Google Gemini API directly (ultimate fallback)
 */
async function callGeminiAPI(messages, options = {}) {
  try {
    console.log('🛡️ Using Gemini as ultimate fallback...');

    if (!MODEL_CONFIG.gemini.apiKey) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    // Convert OpenAI message format to Gemini format
    const geminiMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        parts: [{ text: m.content }]
      }));

    // Add system message as first user message if exists
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      geminiMessages.unshift({
        parts: [{ text: systemMsg.content }]
      });
    }

    const response = await fetch(MODEL_CONFIG.gemini.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': MODEL_CONFIG.gemini.apiKey,
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          temperature: options.temperature || 0.5,
          maxOutputTokens: options.max_tokens || 1000,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Handle streaming vs non-streaming
    if (options.stream) {
      // For streaming, return a mock streaming response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        async *[Symbol.asyncIterator]() {
          // Split into chunks for smooth streaming effect
          const words = text.split(' ');
          for (let i = 0; i < words.length; i++) {
            yield {
              choices: [{
                delta: { content: words[i] + (i < words.length - 1 ? ' ' : '') }
              }]
            };
            // Small delay for streaming effect
            await new Promise(resolve => setTimeout(resolve, 30));
          }
        }
      };
    } else {
      // Non-streaming response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        choices: [{
          message: { content: text }
        }]
      };
    }
  } catch (error) {
    console.error('❌ Gemini fallback failed:', error.message);
    throw error;
  }
}

/**
 * Smart model caller with automatic fallback (OpenRouter → Gemini)
 */
async function callModelWithFallback(messages, options = {}) {
  // Try OpenRouter models first
  const openrouterModels = [
    MODEL_CONFIG.openrouter.primary,
    MODEL_CONFIG.openrouter.fallback1,
    MODEL_CONFIG.openrouter.fallback2,
  ];

  // If we've already switched to Gemini, use it directly
  if (USE_GEMINI_FALLBACK) {
    return await callGeminiAPI(messages, options);
  }

  // Try OpenRouter models
  for (let i = 0; i < openrouterModels.length; i++) {
    const model = openrouterModels[i];
    try {
      console.log(`🔄 Attempting OpenRouter model: ${model}`);

      const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: options.temperature || 0.5,
        max_tokens: options.max_tokens || 1000,
        stream: options.stream || false,
        presence_penalty: options.presence_penalty || 0,
        frequency_penalty: options.frequency_penalty || 0,
      });

      console.log(`✅ Success with OpenRouter model: ${model}`);
      ACTIVE_MODEL = model;
      return response;

    } catch (error) {
      console.error(`❌ OpenRouter model ${model} failed:`, error.message);

      // If this was the last OpenRouter model, try Gemini
      if (i === openrouterModels.length - 1) {
        console.log('⚠️ All OpenRouter models failed, switching to Gemini...');
        try {
          USE_GEMINI_FALLBACK = true;
          return await callGeminiAPI(messages, options);
        } catch (geminiError) {
          throw new Error(`All providers failed. OpenRouter: ${error.message}, Gemini: ${geminiError.message}`);
        }
      }

      // Otherwise, try next OpenRouter model
      console.log(`🔄 Trying next OpenRouter model...`);
    }
  }
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

    console.log('📚 Knowledge Retrieval:', query);
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

    // Deduplicate results based on text content to avoid LLM repetition
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
    console.log('🌐 Web Retrieval (Tavily):', query);
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

/**
 * Agentic AI: Multi-Tool Facilitator (Recursive Reasoning Loop)
 */
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

  let currentMessages = [...routingMessages];
  let turns = 0;
  const maxTurns = 3;
  let accumulatedSources = [];

  onStream('thought', 'Analyzing your request...');

  while (turns < maxTurns) {
    turns++;

    try {
      // Use fast routing model for tool decision with automatic fallback
      const response = await callModelWithFallback(currentMessages, {
        temperature: 0.1,
        max_tokens: 200,
      });

      const agentResponse = response.choices[0].message.content;

      // Tool Detection
      let toolName = null;
      let searchQuery = null;

      const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/i);
      const queryMatch = agentResponse.match(/QUERY:\s*(.+)/i);

      if (toolMatch && queryMatch) {
        toolName = toolMatch[1].trim();
        searchQuery = queryMatch[1].trim();
      }

      if (toolName && searchQuery) {
        const actionLabel = toolName === 'searchDocuments' ? 'Sifting through private library' : 'Scanning live web';
        onStream('thought', `${actionLabel}: "${searchQuery}"`);

        let toolResult = null;
        if (toolName === 'searchDocuments') {
          toolResult = await searchDocuments(searchQuery);
        } else if (toolName === 'searchWeb' || toolName === 'searchTavily') {
          toolResult = await searchWeb(searchQuery);
        }

        if (toolResult && toolResult.success) {
          currentMessages.push({ role: 'assistant', content: agentResponse });
          currentMessages.push({
            role: 'user',
            content: `TOOL RESULTS:\n${toolResult.context}\n\nNow provide the final answer to the user. Be concise and non-repetitive.`
          });

          if (toolResult.results) accumulatedSources.push(...toolResult.results.map(r => r.source));
          if (toolResult.sources) accumulatedSources.push(...toolResult.sources);
        } else {
          // Tool failed, answer from knowledge
          currentMessages.push({ role: 'assistant', content: agentResponse });
          currentMessages.push({ role: 'user', content: `Tool unavailable. Answer from your own knowledge.` });
        }
      } else {
        // No tool call → Stream final answer with the powerful model (with fallback)
        onStream('thought', 'Synthesizing response...');
        onStream('sources', [...new Set(accumulatedSources)].join(','));

        const finalStream = await callModelWithFallback([
          ...currentMessages,
          { role: 'system', content: "Provide your final answer. Be concise, accurate, and non-repetitive." }
        ], {
          temperature: 0.5,
          presence_penalty: 0.4,
          frequency_penalty: 0.5,
          stream: true,
        });

        for await (const chunk of finalStream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            onStream('answer', content);
          }
        }
        return;
      }
    } catch (error) {
      console.error('Agent processing error:', error);
      onStream('thought', 'Encountering issues, retrying with backup provider...');

      // If all providers failed, send error
      if (error.message.includes('All providers failed')) {
        onStream('answer', `I apologize, but I'm having trouble connecting to AI services right now. Please try again in a moment. Error: ${error.message}`);
        return;
      }
    }
  }

  // Max turns reached without completion
  onStream('answer', 'I apologize, but I need more time to process this request. Please try rephrasing your question.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validate required env vars
  if (!process.env.OPENROUTER_API_KEY && !process.env.GOOGLE_API_KEY) {
    return res.status(500).json({
      error: 'Neither OPENROUTER_API_KEY nor GOOGLE_API_KEY is configured. At least one is required.'
    });
  }

  // Set headers for streaming — compatible with Vercel serverless
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

// Per-route Next.js config: raise body limit and allow large streaming responses
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};