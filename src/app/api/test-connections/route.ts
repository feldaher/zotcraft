import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { CraftClient } from '@/lib/craft';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Frontend sends { config: {...} }
        const config = body.config || body;
        const { zotero, craft } = config;

        const result = {
            zotero: false,
            craft: false,
        };

        // Test Zotero
        try {
            const zoteroClient = new ZoteroClient(zotero);
            // Try to fetch collections - this validates API key and user ID
            await zoteroClient.getCollections();
            result.zotero = true;
        } catch (e: any) {
            console.error('Zotero test failed:', e.message);
            result.zotero = false;
        }

        // Test Craft
        try {
            const craftClient = new CraftClient(craft);
            // Try to fetch collections - this validates API key
            await craftClient.getCollections();
            result.craft = true;
        } catch (e: any) {
            console.error('Craft test failed:', e.message);
            result.craft = false;
        }

        console.log('Test results:', result);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Test connections error:', error.message);
        return NextResponse.json(
            { error: 'Failed to test connections' },
            { status: 500 }
        );
    }
}
