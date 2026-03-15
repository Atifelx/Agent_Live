// pages/api/parse.js
// Specialized micro-service for high-fidelity text extraction and semantic chunking

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

async function parseDocument(buffer, fileType) {
    let text = '';
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
        return text;
    } catch (err) {
        console.error(`Extraction Error [${fileType}]:`, err);
        throw err;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { fileContent, fileType } = req.body;
        if (!fileContent) throw new Error('Missing fileContent');

        const buffer = Buffer.from(fileContent, 'base64');
        const text = await parseDocument(buffer, fileType);

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text content found' });
        }

        // Semantic Chunking
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 200,
        });

        const documents = await textSplitter.createDocuments([text]);
        const chunks = documents.map(doc => doc.pageContent);

        console.log(`Parsed into ${chunks.length} semantic chunks.`);

        return res.status(200).json({
            success: true,
            chunks,
        });

    } catch (error) {
        console.error('Parse API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb',
        },
    },
};
