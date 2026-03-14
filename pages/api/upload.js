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
  console.log(`Parsing document type: ${fileType}, buffer size: ${buffer.length}`);

  try {
    if (fileType === 'pdf') {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else if (fileType === 'docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (fileType === 'txt') {
      text = buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    console.log(`Successfully parsed ${fileType}. Text length: ${text.length}`);
    return text;
  } catch (err) {
    console.error(`Error parsing ${fileType}:`, err);
    throw err;
  }
}

export default async function handler(req, res) {
  console.log('--- Upload API Request Received ---');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Upload API Request Body Keys:', Object.keys(req.body || {}));
    const { fileContent, fileName, fileType } = req.body;

    if (!fileContent) {
      console.error('Missing fileContent. Body:', req.body);
      throw new Error('fileContent is missing in request body');
    }

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
        encoding_format: 'float',
        dimensions: EMBEDDING_DIMENSIONS, // Force 768 dimensions
      });

      if (!embeddingResponse || !embeddingResponse.data) {
        console.error('Full Embedding Response:', JSON.stringify(embeddingResponse, null, 2));
        throw new Error('Invalid embedding response from OpenRouter');
      }

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
