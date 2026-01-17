import {QdrantClient} from '@qdrant/js-client-rest';

const client = new QdrantClient({
    url: process.env.QDRANT_URL as string,
    apiKey: process.env.QDRANT_API_KEY as string,
});

try {
    const result = await client.getCollections();
    console.log('List of collections:', result.collections);
} catch (err) {
    console.error('Could not get collections:', err);
}