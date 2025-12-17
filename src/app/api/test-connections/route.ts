import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { CraftClient } from '@/lib/craft';
import { ZoteroConfig } from '@/types/zotero';
import { CraftConfig } from '@/types/craft';

export async function POST(request: Request) {
    try {
        const { config } = await request.json();
        const { zotero, craft } = config as {
            zotero: ZoteroConfig;
            craft: CraftConfig;
        };

        const result = {
            zotero: false,
            craft: false,
        };

        // Test Zotero
        try {
            const zoteroClient = new ZoteroClient(zotero);
            await zoteroClient.getCollectionItems(1);
            result.zotero = true;
        } catch (e) {
            console.error('Zotero test failed:', e);
        }

        // Test Craft
        try {
            const craftClient = new CraftClient(craft);
            await craftClient.getCollections();
            result.craft = true;
        } catch (e) {
            console.error('Craft test failed:', e);
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Test connections error:', error);
        return NextResponse.json(
            { error: 'Failed to test connections' },
            { status: 500 }
        );
    }
}
