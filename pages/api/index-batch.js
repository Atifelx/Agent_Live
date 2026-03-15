// pages/api/index-batch.js
// Stateless micro-service for embedding and indexing a single batch of chunks

import { Pinecone } from '@pinecone-database/pinecone';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { batchTexts, fileName, startIndex } = req.body;
        if (!batchTexts || !Array.isArray(batchTexts)) throw new Error('Invalid batch data');

        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

        // 1. Generate Embeddings (v2 models)
        const embeddingResponse = await pinecone.inference.embed(
            'llama-text-embed-v2',
            batchTexts,
            { inputType: 'passage', truncate: 'END' }
        );

        if (!embeddingResponse?.data) {
            throw new Error('Pinecone Inference failed');
        }

        // 2. Prepare Vectors
        const now = Date.now();
        const vectors = embeddingResponse.data.map((data, idx) => ({
            id: `${fileName}-${now}-${startIndex + idx}`,
            values: data.values,
            metadata: {
                text: batchTexts[idx],
                source: fileName,
                chunkIndex: startIndex + idx,
            },
        }));

        // 3. Upsert Batch
        await index.upsert(vectors);

        console.log(`Indexed batch starting at ${startIndex} (${batchTexts.length} chunks)`);

        return res.status(200).json({ success: true, count: batchTexts.length });

    } catch (error) {
        console.error('Index Batch API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
