// pages/api/list-docs.js
// Queries Pinecone for all unique document sources in the knowledge base

import { Pinecone } from '@pinecone-database/pinecone';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

        // Query with a dummy zero vector to fetch a broad sample of records
        // We use topK=100 to maximize coverage, and only pull metadata
        const dummyVector = new Array(1024).fill(0);
        const results = await index.query({
            vector: dummyVector,
            topK: 100,
            includeMetadata: true,
        });

        // Extract unique source filenames from metadata
        const sources = new Set();
        if (results.matches) {
            for (const match of results.matches) {
                if (match.metadata?.source) {
                    sources.add(match.metadata.source);
                }
            }
        }

        const uniqueSources = Array.from(sources);

        return res.status(200).json({
            success: true,
            sources: uniqueSources,
            count: uniqueSources.length,
        });

    } catch (error) {
        console.error('List Docs API Error:', error);
        return res.status(500).json({ success: false, error: error.message, sources: [] });
    }
}
