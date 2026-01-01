export interface CraftConfig {
    linkId: string;  // User's unique Craft link ID (from API URL) - this IS the authentication
    apiKey?: string; // DEPRECATED: Not used - Craft API authenticates via linkId in URL
    spaceId?: string; // Not explicitly used in the provided API URL but might be part of the setup
    parentDocumentId: string;
    targetCollectionId?: string;
}

export interface CraftBlock {
    id?: string;
    type: string;
    textStyle?: string;
    markdown?: string;
    content?: CraftBlock[];
    url?: string;
    altText?: string;
    position?: {
        position: 'before' | 'after' | 'end';
        pageId?: string;
        blockId?: string;
    };
}

export interface CraftCollection {
    id: string;
    name: string;
    documentId: string;
}

export interface CraftResponse<T> {
    items: T[];
}
