import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { CraftClient } from '@/lib/craft';
import { AIClient } from '@/lib/ai';
import { getSyncState, markAsProcessed } from '@/lib/state';
import { ZoteroConfig } from '@/types/zotero';
import { CraftConfig } from '@/types/craft';
import { AIConfig } from '@/types/ai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { config, maxItems = 10, skipProcessed = true } = body;
        const { zotero, craft, ai } = config as {
            zotero: ZoteroConfig;
            craft: CraftConfig;
            ai: AIConfig;
        };

        const logs: Array<{ title: string; status: string; details?: string }> = [];
        const state = await getSyncState();

        const zoteroClient = new ZoteroClient(zotero);
        const craftClient = new CraftClient(craft);
        const aiClient = new AIClient(ai);

        // 1. Fetch items
        const items = await zoteroClient.getCollectionItems(maxItems);

        for (const item of items) {
            const itemTitle = item.data.title || 'Untitled';

            if (skipProcessed && state.processedKeys.includes(item.key)) {
                logs.push({ title: itemTitle, status: 'skipped', details: 'Already processed' });
                continue;
            }

            try {
                // 2. Prepare content
                const creators = ZoteroClient.formatAuthors(item.data.creators);
                const year = ZoteroClient.extractYear(item.data.date);
                const journal = item.data.publicationTitle || '';
                const url = item.data.url || item.data.DOI || '';

                // Format tags: #tag_name
                const rawTags = item.data.tags || [];
                const formattedTags = rawTags.map((t: any) => {
                    const tagName = t.tag.replace(/\s+/g, '_');
                    return `#${tagName}`;
                });
                const tagsString = formattedTags.join(' ');
                const tags = formattedTags;

                const abstract = item.data.abstractNote || '';

                // 3. AI Summary
                let aiSummary = '';
                if (ai.enabled) {
                    aiSummary = await aiClient.generateSummary(itemTitle, abstract);
                } else {
                    aiSummary = '_AI summary disabled._';
                }

                // 4. Transform to Markdown
                const markdownBody = `
**Authors:** ${creators}
**Year:** ${year}
**Journal:** ${journal}
**Link:** ${url}
**Tags:** ${tagsString}

## Summary
${aiSummary}

## Key Ideas
- 

## Quotes
- 

## Critique
- 

## Related Work
- 
`;

                // 5. Create in Craft
                if (craft.targetCollectionId) {
                    await craftClient.createCollectionItem(craft.targetCollectionId, itemTitle, markdownBody);
                } else {
                    // Fallback to creating sub-page
                    await craftClient.createNote(itemTitle, markdownBody, tags);
                }

                // 6. Update State
                await markAsProcessed(item.key);

                logs.push({ title: itemTitle, status: 'created' });
            } catch (err: any) {
                console.error(`Error processing item ${item.key}:`, err);
                logs.push({ title: itemTitle, status: 'error', details: err.message });
            }
        }

        return NextResponse.json({ logs });
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json(
            { error: 'Sync process failed' },
            { status: 500 }
        );
    }
}
