import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// Initialize OpenRouter client for embeddings
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Using Google Gemini Embedding 001 (free) forced to 768 dimensions
const EMBEDDING_MODEL = 'google/gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768; // Crucial match for Pinecone

// Initialize Pinecone
const initPinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pinecone.index(process.env.PINECONE_INDEX_NAME);
};

// Parse different file types
async function parseDocument(buffer, fileType) {
  let text = '';
console.log('Imports worked');
