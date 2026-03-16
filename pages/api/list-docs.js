// pages/api/list-docs.js
// Fetches all unique document sources from Pinecone metadata

import { Pinecone } from '@pinecone-database/pinecone';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Validate env vars early
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
        console.error('Missing PINECONE_API_KEY or PINECONE_INDEX_NAME env vars');
        return res.status(200).json({ success: false, sources: [], error: 'Missing environment variables' });
    }

    try {
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

        // Get index stats to check if it's empty first
        const stats = await index.describeIndexStats();
        const totalVectorCount = stats.totalRecordCount ?? stats.totalVectorCount ?? 0;

        if (totalVectorCount === 0) {
            return res.status(200).json({ success: true, sources: [], count: 0 });
        }

        // Get the index dimension from stats to build a valid zero vector
        const dimension = stats.dimension ?? 1024;
        const dummyVector = new Array(dimension).fill(0.001); // Small non-zero to avoid cosine issues

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
        console.error('List Docs API Error:', error.message);
        // Return empty list gracefully — don't crash the frontend
        return res.status(200).json({ success: false, error: error.message, sources: [] });
    }
}
