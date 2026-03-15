// pages/api/delete.js
import { Pinecone } from '@pinecone-database/pinecone';

export default async function handler(req, res) {
    console.log('--- Delete API Request Received ---');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

        console.log(`Clearing all data in index: ${process.env.PINECONE_INDEX_NAME}...`);

        // Pinecone v3 method to delete all records in a namespace (default namespace if not specified)
        await index.deleteAll();

        return res.status(200).json({
            success: true,
            message: 'All document data has been successfully deleted from the database.',
        });

    } catch (error) {
        console.error('Delete error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete database content',
            details: error.message,
        });
    }
}
