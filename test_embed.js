const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: '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',
  baseURL: 'https://openrouter.ai/api/v1',
});

async function test() {
  const models = ['google/text-embedding-004', 'openai/text-embedding-3-small', 'text-embedding-3-small'];
  for (const model of models) {
    try {
      console.log('Testing model:', model);
      const response = await openai.embeddings.create({
        model: model,
        input: 'test',
      });
      console.log('SUCCESS:', model, 'DIMS:', response.data[0].embedding.length);
    } catch (err) {
      console.log('FAIL:', model, 'ERROR:', err.message);
    }
  }
}
test();
