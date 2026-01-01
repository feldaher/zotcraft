import { CraftConfig, CraftBlock, CraftResponse } from '@/types/craft';

export class CraftClient {
    private config: CraftConfig;
    private apiBase: string;

    constructor(config: CraftConfig) {
        this.config = config;
        // The link ID in the URL IS the authentication - no separate bearer token needed
        this.apiBase = `https://connect.craft.do/links/${config.linkId}/api/v1`;
    }

    private getHeaders() {
        return {
            'Content-Type': 'application/json',
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            // Fetch documents list to verify access
            const response = await fetch(`${this.apiBase}/documents?limit=1`, {
                headers: this.getHeaders(),
            });
            return response.ok;
        } catch (error) {
            console.error('Craft connection test failed:', error);
            return false;
        }
    }

    async createNote(
        title: string,
        contentMarkdown: string,
        tags: string[] = []
    ): Promise<string> {
        try {
            // We create a new "page" block (Card) inside the parent document
            // contentMarkdown contains the body.
            // We might want to construct structured blocks, but markdown is easier.

            const noteBlock: CraftBlock = {
                type: 'page', // Creates a subpage/card
                textStyle: 'card',
                markdown: title, // Title of the card
                content: [
                    {
                        type: 'text',
                        markdown: contentMarkdown
                    }
                ]
            };

            const response = await fetch(`${this.apiBase}/blocks`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    blocks: [noteBlock],
                    position: {
                        position: 'end',
                        pageId: this.config.parentDocumentId,
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create Craft note: ${response.status} ${errorText}`);
            }

            const data: CraftResponse<CraftBlock> = await response.json();
            const createdBlock = data.items[0];

            // If we want to add tags, we might need to modify the block or content?
            // PRD says "Include tags: either embed tags in the body... and/or use Craft's tagging"
            // We already embedded tags in markdown body in the contentMarkdown construction.

            return createdBlock.id || 'unknown';
        } catch (error) {
            console.error('Error creating Craft note:', error);
            throw error;
        }
    }

    async getCollections(): Promise<import('@/types/craft').CraftCollection[]> {
        try {
            const response = await fetch(`${this.apiBase}/collections`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Craft collections: ${response.statusText}`);
            }

            const data: CraftResponse<import('@/types/craft').CraftCollection> = await response.json();
            return data.items;
        } catch (error) {
            console.error('Error fetching Craft collections:', error);
            throw error;
        }
    }

    async checkItemExists(collectionId: string | undefined, title: string): Promise<boolean> {
        try {
            // Check in collection if collectionId provided, otherwise check in parent document
            if (collectionId) {
                // Get items from collection
                const response = await fetch(`${this.apiBase}/collections/${collectionId}/items`, {
                    headers: this.getHeaders(),
                });

                if (!response.ok) {
                    console.error(`Failed to fetch collection items: ${response.statusText}`);
                    return false;
                }

                const data = await response.json();
                const items = data.items || [];

                // Check if any item has matching title
                return items.some((item: any) => item.title?.trim() === title.trim());
            } else if (this.config.parentDocumentId) {
                // Get blocks from parent document
                const response = await fetch(`${this.apiBase}/documents/${this.config.parentDocumentId}`, {
                    headers: this.getHeaders(),
                });

                if (!response.ok) {
                    console.error(`Failed to fetch document: ${response.statusText}`);
                    return false;
                }

                const data = await response.json();
                const blocks = data.blocks || [];

                // Check if any block/page has matching title (in markdown)
                return blocks.some((block: any) =>
                    block.type === 'page' && block.markdown?.trim() === title.trim()
                );
            }

            return false;
        } catch (error) {
            console.error('Error checking item existence:', error);
            return false; // On error, assume doesn't exist to allow creation
        }
    }

    async getCollectionSchema(collectionId: string): Promise<any> {
        try {
            // Fetch schema with default format (json-schema-items is default but we want the edit schema structure to see display names)
            // Actually the docs say format='schema' returns structure with names/keys
            const response = await fetch(`${this.apiBase}/collections/${collectionId}/schema?format=schema`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                console.warn(`Failed to fetch collection schema: ${response.statusText}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching collection schema:', error);
            return null;
        }
    }

    async createCollectionItem(
        collectionId: string,
        title: string,
        contentMarkdown: string,
        properties: Record<string, any> = {}
    ): Promise<string> {
        try {
            // Step 1: Create the item in the collection
            const createResponse = await fetch(`${this.apiBase}/collections/${collectionId}/items`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    items: [
                        {
                            title: title,
                            properties: properties
                        }
                    ]
                })
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to create Craft collection item: ${createResponse.status} ${errorText}`);
            }

            const createData = await createResponse.json();
            const newItemId = createData.items[0]?.id;

            if (!newItemId) {
                throw new Error('Created item ID not found');
            }

            // Step 2: Add content to the item
            const contentResponse = await fetch(`${this.apiBase}/blocks`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    blocks: [
                        {
                            type: 'text',
                            markdown: contentMarkdown
                        }
                    ],
                    position: {
                        position: 'end',
                        pageId: newItemId
                    }
                })
            });

            if (!contentResponse.ok) {
                const errorText = await contentResponse.text();
                console.error(`Failed to populate content for item ${newItemId}: ${contentResponse.status} ${errorText}`);
            }

            return newItemId;
        } catch (error) {
            console.error('Error creating Craft collection item:', error);
            throw error;
        }
    }
}
