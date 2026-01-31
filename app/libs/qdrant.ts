import {QdrantClient} from '@qdrant/js-client-rest';

export const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL as string,
    apiKey: process.env.QDRANT_API_KEY as string,
});

try {
    const result = await qdrantClient.getCollections();
    console.log('List of collections:', result.collections);
} catch (err) {
    console.error('Could not get collections:', err);
}