import { ZoteroConfig, ZoteroItem } from '@/types/zotero';

const ZOTERO_API_BASE = 'https://api.zotero.org';

export class ZoteroClient {
    private config: ZoteroConfig;

    constructor(config: ZoteroConfig) {
        this.config = config;
    }

    private getHeaders() {
        return {
            'Zotero-API-Key': this.config.apiKey,
            'Zotero-API-Version': '3',
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            // Fetch a single item to verify credentials and access
            const response = await fetch(
                `${ZOTERO_API_BASE}/users/${this.config.userId}/items?limit=1`,
                {
                    headers: this.getHeaders(),
                }
            );
            return response.ok;
        } catch (error) {
            console.error('Zotero connection test failed:', error);
            return false;
        }
    }

    async getCollectionItems(limit: number = 20): Promise<ZoteroItem[]> {
        try {
            // Fetch top items from the collection, sorted by modification date desc
            // We rely on the user to provide the collection ID
            const url = `${ZOTERO_API_BASE}/users/${this.config.userId}/collections/${this.config.collectionId}/items/top?limit=${limit}&sort=dateModified&direction=desc`;

            const response = await fetch(url, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Zotero items: ${response.statusText}`);
            }

            const items = await response.json();
            return items as ZoteroItem[];
        } catch (error) {
            console.error('Error fetching Zotero items:', error);
            throw error;
        }
    }

    async getCollections(): Promise<import('@/types/zotero').ZoteroCollection[]> {
        try {
            const response = await fetch(
                `${ZOTERO_API_BASE}/users/${this.config.userId}/collections`,
                {
                    headers: this.getHeaders(),
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch Zotero collections: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching Zotero collections:', error);
            throw error;
        }
    }

    /**
     * Helper to format authors from Zotero creators array
     */
    static formatAuthors(creators: ZoteroItem['data']['creators']): string {
        if (!creators || creators.length === 0) return 'Unknown Author';
        return creators
            .map((c) => c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim())
            .join(', ');
    }

    /**
     * Helper to extract the year from a date string
     */
    static extractYear(dateString?: string): string {
        if (!dateString) return '';
        const match = dateString.match(/\d{4}/);
        return match ? match[0] : dateString;
    }
}
