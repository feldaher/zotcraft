import { NextResponse } from 'next/server';
import { CraftClient } from '@/lib/craft';
import { CraftConfig } from '@/types/craft';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const config = body as CraftConfig;

        if (!config.apiKey) {
            return NextResponse.json(
                { error: 'Missing Craft credentials' },
                { status: 400 }
            );
        }

        // We treat parentDocumentId mainly for sub-page creation fallback, 
        // but for fetching collections we don't strictly need it if we fetch all collections.
        // However, the client constructor needs it.
        const client = new CraftClient({
            apiKey: config.apiKey,
            parentDocumentId: config.parentDocumentId || 'dummy'
        });

        const collections = await client.getCollections();

        return NextResponse.json(collections);
    } catch (error) {
        console.error('Craft Collections fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch collections' },
            { status: 500 }
        );
    }
}
