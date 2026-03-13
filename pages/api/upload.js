// pages/api/upload.js
// API route to handle document upload and vector storage using OpenRouter

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// Initialize OpenRouter client for embeddings
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Using BAAI BGE Large En v1.5 for embeddings (1024 dimensions) to match Pinecone index
const EMBEDDING_MODEL = 'baai/bge-large-en-v1.5';

// Initialize Pinecone
const initPinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pinecone.index(process.env.PINECONE_INDEX_NAME);
};

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Parse different file types
async function parseDocument(buffer, fileType) {
  let text = '';

  if (fileType === 'pdf') {
    const pdfData = await pdfParse(buffer);
    text = pdfData.text;
  } else if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (fileType === 'txt') {
    text = buffer.toString('utf-8');
  } else {
    throw new Error('Unsupported file type');
  }

  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileContent, fileName, fileType } = req.body;

    // Decode base64 file content
    const buffer = Buffer.from(fileContent, 'base64');

    // Parse document
    const text = await parseDocument(buffer, fileType);

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text content found in document' });
    }

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await textSplitter.createDocuments([text]);

    // Initialize services
    const index = await initPinecone();
    const vectors = [];

    // Process chunks in batches to avoid rate limits and too large requests
    const batchSize = 10; // Batch size for embeddings
    for (let i = 0; i < chunks.length; i += batchSize) {
      const currentBatch = chunks.slice(i, i + batchSize);
      const batchTexts = currentBatch.map(c => c.pageContent);

      // Generate embeddings via OpenRouter
      const embeddingResponse = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batchTexts,
      });

      embeddingResponse.data.forEach((data, indexInBatch) => {
        const chunk = currentBatch[indexInBatch];
        vectors.push({
          id: `${fileName}-${Date.now()}-${i + indexInBatch}`,
          values: data.embedding,
          metadata: {
            text: chunk.pageContent,
            source: fileName,
            chunkIndex: i + indexInBatch,
          },
        });
      });
    }

    // Upsert vectors to Pinecone in batches
    const pineconeBatchSize = 100;
    for (let i = 0; i < vectors.length; i += pineconeBatchSize) {
      const batch = vectors.slice(i, i + pineconeBatchSize);
      await index.upsert(batch);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${chunks.length} chunks from ${fileName}`,
      chunks: chunks.length,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Failed to process document',
      details: error.message,
    });
  }
}

// Increase payload size limit for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
