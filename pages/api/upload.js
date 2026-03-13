// pages/api/upload.js
// API route to handle document upload and vector storage

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitters';
import { Document } from 'langchain/document';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Initialize Pinecone
const initPinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pinecone.index(process.env.PINECONE_INDEX_NAME);
};

// Initialize Google Gemini Embeddings (FREE)
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: 'embedding-001',
});

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
    
    // Generate embeddings for each chunk
    const index = await initPinecone();
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embeddings.embedQuery(chunk.pageContent);
      
      vectors.push({
        id: `${fileName}-${Date.now()}-${i}`,
        values: embedding,
        metadata: {
          text: chunk.pageContent,
          source: fileName,
          chunkIndex: i,
        },
      });
    }

    // Upsert vectors to Pinecone in batches
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
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
