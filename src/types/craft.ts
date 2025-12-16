export interface CraftConfig {
    apiKey: string;
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
