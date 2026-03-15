import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// Initialize OpenRouter client for embeddings
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});


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
  const keyMatch = process.env.OPENROUTER_API_KEY ? `Key present, length: ${process.env.OPENROUTER_API_KEY.length}, starts with: ${process.env.OPENROUTER_API_KEY.substring(0, 10)}...` : 'Key MISSING';
  console.log('API Key Status:', keyMatch);

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
      chunkSize: 500,   // More granular chunks for better specificity
      chunkOverlap: 200, // Higher overlap to maintain context across chunks
    });

    const chunks = await textSplitter.createDocuments([text]);

    // Initialize services
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    const vectors = [];

    // Process chunks in batches to avoid rate limits
    const batchSize = 90; // Pinecone Inference handles larger batches (up to 96)
    console.log(`Generating embeddings for ${chunks.length} chunks using Pincone Inference...`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const currentBatch = chunks.slice(i, i + batchSize);
      const batchTexts = currentBatch.map(c => c.pageContent);

      // Generate embeddings via Pinecone Inference
      // IMPORTANT: Must match the model used when the index was created (llama-text-embed-v2)
      const embeddingResponse = await pinecone.inference.embed(
        'llama-text-embed-v2',
        batchTexts,
        { inputType: 'passage', truncate: 'END' }
      );

      if (!embeddingResponse || !embeddingResponse.data) {
        throw new Error('Invalid embedding response from Pinecone');
      }

      embeddingResponse.data.forEach((data, indexInBatch) => {
        const chunk = currentBatch[indexInBatch];
        vectors.push({
          id: `${fileName}-${Date.now()}-${i + indexInBatch}`,
          values: data.values, // Note: Pinecone returns 'values' not 'embedding'
          metadata: {
            text: chunk.pageContent,
            source: fileName,
            chunkIndex: i + indexInBatch,
          },
        });
      });
    }

    // Upsert vectors to Pinecone in batches
    console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
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

// Increase payload size limit for large file uploads (10MB PDF ~ 13MB base64)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
