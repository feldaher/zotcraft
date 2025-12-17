import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { CraftClient } from '@/lib/craft';

export async function POST(request: Request) {
    try {
        const { config } = await request.json();
        const { zotero, craft } = config;

        const result = {
            zotero: false,
            craft: false,
        };

        // Test Zotero - try to fetch collections
        if (zotero?.userId && zotero?.apiKey) {
            try {
                const zoteroClient = new ZoteroClient(zotero);
                await zoteroClient.getCollections();
                result.zotero = true;
            } catch (e: any) {
                console.error('Zotero test failed:', e.message);
            }
        }

        // Test Craft - try to fetch collections
        if (craft?.apiKey) {
            try {
                const craftClient = new CraftClient(craft);
                await craftClient.getCollections();
                result.craft = true;
            } catch (e: any) {
                console.error('Craft test failed:', e.message);
            }
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Test connections error:', error.message);
        return NextResponse.json(
            { error: 'Failed to test connections' },
            { status: 500 }
        );
    }
}

