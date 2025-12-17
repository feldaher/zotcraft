import { NextResponse } from 'next/server';
import { ZoteroClient } from '@/lib/zotero';
import { CraftClient } from '@/lib/craft';
import { ZoteroConfig } from '@/types/zotero';
import { CraftConfig } from '@/types/craft';

// Helper to format camelCase to Title Case (e.g. journalArticle -> Journal Article)
function formatItemType(type: string): string {
    if (!type) return '';
    // Split by capital letters, capitalize first letter, join with space
    return type
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
}

export async function POST(request: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const body = await request.json();
                const { config, maxItems = 10 } = body;
                const { zotero, craft } = config as {
                    zotero: ZoteroConfig;
                    craft: CraftConfig;
                };

                const zoteroClient = new ZoteroClient(zotero);
                const craftClient = new CraftClient(craft);

                // 1. Fetch schema if target collection is set
                let schemaMap: Record<string, { key: string; type: string; options?: string[] }> = {}; // Name -> { key, type, options }
                if (craft.targetCollectionId) {
                    try {
                        const schema = await craftClient.getCollectionSchema(craft.targetCollectionId);
                        if (schema && schema.properties) {
                            schema.properties.forEach((prop: any) => {
                                schemaMap[prop.name] = {
                                    key: prop.key,
                                    type: prop.type,
                                    options: prop.options, // For single-select or multi-select fields
                                };
                            });
                        }
                    } catch (e: any) {
                        const log = { title: 'System', status: 'warning', details: `Failed to fetch schema: ${e.message}` };
                        controller.enqueue(encoder.encode(JSON.stringify(log) + '\n'));
                    }
                }

                // 2. Fetch items
                let items: any[] = [];
                try {
                    items = await zoteroClient.getCollectionItems(maxItems);
                } catch (e: any) {
                    const log = { title: 'System', status: 'error', details: `Failed to fetch Zotero items: ${e.message}` };
                    controller.enqueue(encoder.encode(JSON.stringify(log) + '\n'));
                    controller.close();
                    return;
                }

                for (const item of items) {
                    const itemTitle = item.data.title || 'Untitled';

                    try {
                        // 3. Check if already exists in Craft
                        const exists = await craftClient.checkItemExists(craft.targetCollectionId, itemTitle);

                        if (exists) {
                            const log = { title: itemTitle, status: 'skipped', details: 'Already exists in Craft' };
                            controller.enqueue(encoder.encode(JSON.stringify(log) + '\n'));
                            continue;
                        }

                        // 4. Prepare content & properties
                        const creators = ZoteroClient.formatAuthors(item.data.creators);
                        const year = ZoteroClient.extractYear(item.data.date);
                        const journal = item.data.publicationTitle || '';
                        const url = item.data.url || item.data.DOI || '';
                        const dateAdded = item.data.dateAdded ? new Date(item.data.dateAdded).toISOString().split('T')[0] : '';

                        // Format Item Type
                        const rawItemType = item.data.itemType || '';
                        const formattedItemType = formatItemType(rawItemType);

                        // Format tags: #tag_name
                        const rawTags = item.data.tags || [];
                        const formattedTags = rawTags.map((t: any) => {
                            const tagName = t.tag.replace(/\s+/g, '_');
                            return `#${tagName}`;
                        });
                        const tagsString = formattedTags.join(' ');
                        const tags = formattedTags;

                        const abstract = item.data.abstractNote || '';

                        // Map properties to Craft schema keys
                        const properties: Record<string, any> = {};

                        // Helper to validate and format value based on schema type
                        const setProp = (fieldName: string, value: any) => {
                            const fieldSchema = schemaMap[fieldName];
                            if (!fieldSchema || !value) return;

                            const propKey = fieldSchema.key;

                            // Handle different types
                            if (fieldSchema.type === 'number') {
                                const num = parseInt(String(value), 10);
                                if (!isNaN(num)) {
                                    properties[propKey] = num;
                                }
                            } else if (fieldSchema.type === 'url') {
                                // Ensure it's a string, maybe validate URL format if needed
                                properties[propKey] = String(value);
                            } else if (fieldSchema.type === 'date') {
                                // Craft expects YYYY-MM-DD string for date type, which we already prepare
                                properties[propKey] = String(value);
                            } else if (fieldSchema.type === 'select' || fieldSchema.type === 'multiSelect') {
                                // Validate against options
                                const options = fieldSchema.options || [];
                                const strValue = String(value);
                                // Case-insensitive match or exact match? API usually requires exact match.
                                // Let's try to find an exact match, or a case-insensitive one to be helpful.
                                const validOption = options.find(opt => opt.toLowerCase() === strValue.toLowerCase());

                                if (validOption) {
                                    if (fieldSchema.type === 'select') {
                                        properties[propKey] = validOption;
                                    } else {
                                        // multiSelect expects array
                                        properties[propKey] = [validOption];
                                    }
                                } else {
                                    // If no match found (e.g. 'To Read' vs 'Waiting'), check for manual mapping
                                    if (fieldName === 'Reading status' && strValue === 'To Read') {
                                        const waitingOpt = options.find(opt => opt.toLowerCase() === 'waiting');
                                        if (waitingOpt) {
                                            properties[propKey] = waitingOpt;
                                        } else {
                                            // Skip invalid option to prevent 400 error
                                            console.warn(`Skipping invalid option '${strValue}' for field '${fieldName}'`);
                                        }
                                    } else {
                                        // Skip invalid option to prevent 400 error
                                        console.warn(`Skipping invalid option '${strValue}' for field '${fieldName}'. Valid options: ${options.join(', ')}`);
                                    }
                                }
                            } else if (fieldSchema.type === 'text' || fieldSchema.type === 'richText') {
                                properties[propKey] = String(value);
                            } else if (fieldSchema.type === 'multiSelect' || fieldSchema.key === 'tags' || Array.isArray(value)) {
                                // If schema expects array (like for native 'tags' if that's exposed as array)
                                // But for 'multiSelect' we handled above.
                                // The error said "expected: array, code: invalid_type, path: tags".
                                // If the field type in Craft is actually 'tags' (it might be a specific type or multi-select).
                                // Let's assume if it expects array, we give it array.
                                if (Array.isArray(value)) {
                                    properties[propKey] = value;
                                } else if (typeof value === 'string' && value.includes(',')) {
                                    properties[propKey] = value.split(',').map(s => s.trim());
                                } else {
                                    properties[propKey] = [String(value)];
                                }
                            } else {
                                // Default fallback
                                properties[propKey] = value;
                            }
                        };

                        // Map known fields (Robust against missing fields in schema)
                        setProp('Authors', creators);
                        setProp('Year', year); // schema check will convert to number if needed
                        setProp('Journal', journal);
                        setProp('URL', url);
                        setProp('Date added', dateAdded);
                        setProp('Publication type', formattedItemType); // Use Formatted Type

                        // Tags: The Zotero tags are array of strings: formattedTags
                        // If Craft field expects array, we pass array. If text, we join.
                        // We need to check schema type for 'Tags'.
                        const tagsSchema = schemaMap['Tags'];
                        if (tagsSchema) {
                            if (tagsSchema.type === 'text' || tagsSchema.type === 'richText') {
                                setProp('Tags', tags.join(', '));
                            } else {
                                // Expects array (multiSelect or similar)
                                // Note: Zotero tags might not match Craft select options unless we create them?
                                if (tagsSchema.type === 'multiSelect' && tagsSchema.options && tagsSchema.options.length > 0) {
                                    const tagsList = tags as string[]; // Cast value to string array since we know it is
                                    const validTags = tagsList.filter((t: string) =>
                                        tagsSchema.options?.some(opt => opt.toLowerCase() === t.replace('#', '').toLowerCase())
                                    );

                                    // Only set property if we have valid tags, or if we want to send what matches
                                    if (validTags.length > 0) {
                                        // Map back to the exact option string from schema to be safe
                                        const mappedTags = validTags.map((t: string) => {
                                            return tagsSchema.options?.find(opt => opt.toLowerCase() === t.replace('#', '').toLowerCase()) || t;
                                        });
                                        properties[tagsSchema.key] = mappedTags;
                                    }
                                    // If no tags match options, we skip setting the property to avoid error
                                } else {
                                    // If it's not a restricted multiSelect (or options are empty?), assume we can pass array
                                    // But wait, the previous error for Journal said "Valid options: ." meaning empty list?
                                    // If options are strict and empty, we can't send anything.

                                    // Logic: If it's multiSelect, we should strictly check options if they exist.
                                    // If options are empty/undefined, maybe it allows creation? The error for Journal implies strictness.
                                    // Let's assume strictness for safety.
                                    if (tagsSchema.type === 'multiSelect') {
                                        // If no options defined, likely can't add new ones via API this way without "create option" endpoint?
                                        // Better to skip tags than fail item creation.
                                        console.warn(`Skipping tags for multiSelect field '${tagsSchema.key}' as strict matching is required.`);
                                    } else {
                                        // Generic array or tag type
                                        properties[tagsSchema.key] = tags;
                                    }
                                }
                            }
                        }

                        // Also 'Reading status'
                        // The error said valid options: Waiting, Next up, In progress, Done.
                        setProp('Reading status', 'To Read'); // Will be mapped to 'Waiting' by setProp logic above

                        // 5. Transform to Markdown
                        const markdownBody = `
**Authors:** ${creators}
**Year:** ${year}
**Journal:** ${journal}
**Link:** ${url}
**Date Added:** ${dateAdded}
**Publication Type:** ${formattedItemType}
**Tags:** ${tagsString}

**Abstract:**
${abstract || 'No abstract available.'}

## Key Ideas
- 

## Quotes
- 

## Critique
- 

## Related Work
- 
`;

                        // 6. Create in Craft
                        if (craft.targetCollectionId) {
                            await craftClient.createCollectionItem(craft.targetCollectionId, itemTitle, markdownBody, properties);
                        } else {
                            // Fallback to creating sub-page
                            await craftClient.createNote(itemTitle, markdownBody, tags);
                        }

                        const log = { title: itemTitle, status: 'created' };
                        controller.enqueue(encoder.encode(JSON.stringify(log) + '\n'));
                    } catch (err: any) {
                        console.error(`Error processing item ${itemTitle}:`, err);
                        const log = { title: itemTitle, status: 'error', details: err.message };
                        controller.enqueue(encoder.encode(JSON.stringify(log) + '\n'));
                    }
                }

                controller.close();
            } catch (error: any) {
                console.error('Sync error:', error);
                const log = { title: 'System', status: 'error', details: 'Critical sync failure' };
                controller.enqueue(encoder.encode(JSON.stringify(log) + '\n'));
                controller.close();
            }
        }
    });

    return new NextResponse(stream);
}
