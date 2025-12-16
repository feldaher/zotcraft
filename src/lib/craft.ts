import { CraftConfig, CraftBlock, CraftResponse } from '@/types/craft';

const CRAFT_API_BASE = 'https://connect.craft.do/links/COCqm12afk6/api/v1'; // Using the specific endpoint from docs

export class CraftClient {
    private config: CraftConfig;

    constructor(config: CraftConfig) {
        this.config = config;
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            // Fetch documents list to verify access
            const response = await fetch(`${CRAFT_API_BASE}/documents?limit=1`, {
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

            const response = await fetch(`${CRAFT_API_BASE}/blocks`, {
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
            const response = await fetch(`${CRAFT_API_BASE}/collections`, {
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

    async createCollectionItem(
        collectionId: string,
        title: string,
        contentMarkdown: string
    ): Promise<string> {
        try {
            // Step 1: Create the item in the collection
            const createResponse = await fetch(`${CRAFT_API_BASE}/collections/${collectionId}/items`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    items: [
                        {
                            title: title,
                            properties: {}
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
            const contentResponse = await fetch(`${CRAFT_API_BASE}/blocks`, {
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
