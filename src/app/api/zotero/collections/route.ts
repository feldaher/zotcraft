import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { ZoteroConfig } from '@/types/zotero';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const config = body as ZoteroConfig;

        if (!config.userId || !config.apiKey) {
            return NextResponse.json(
                { error: 'Missing Zotero credentials' },
                { status: 400 }
            );
        }

        const client = new ZoteroClient(config);
        const collections = await client.getCollections();

        return NextResponse.json(collections);
    } catch (error) {
        console.error('Collections fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch collections' },
            { status: 500 }
        );
    }
}
