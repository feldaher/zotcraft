import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { CraftClient } from '@/lib/craft';
import { AIClient } from '@/lib/ai';
import { ZoteroConfig } from '@/types/zotero';
import { CraftConfig } from '@/types/craft';
import { AIConfig } from '@/types/ai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { zotero, craft, ai } = body as {
            zotero: ZoteroConfig;
            craft: CraftConfig;
            ai: AIConfig;
        };

        const results = {
            zotero: false,
            craft: false,
            ai: false,
        };

        // Test Zotero
        if (zotero.userId && zotero.apiKey && zotero.collectionId) {
            const zoteroClient = new ZoteroClient(zotero);
            results.zotero = await zoteroClient.testConnection();
        }

        // Test Craft
        if (craft.apiKey && craft.parentDocumentId) {
            const craftClient = new CraftClient(craft);
            results.craft = await craftClient.testConnection();
        }

        // Test AI
        if (ai.enabled && ai.apiKey && ai.endpoint) {
            const aiClient = new AIClient(ai);
            results.ai = await aiClient.testConnection();
        } else if (!ai.enabled) {
            results.ai = true; // Skipped is considered success/neutral
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Test connections error:', error);
        return NextResponse.json(
            { error: 'Failed to test connections' },
            { status: 500 }
        );
    }
}
