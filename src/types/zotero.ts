export interface ZoteroConfig {
  userId: string;
  apiKey: string;
  collectionId: string;
}

export interface ZoteroItemData {
  key: string;
  version: number;
  itemType: string;
  title: string;
  creators: Array<{
    creatorType: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }>;
  date?: string;
  publicationTitle?: string; // Journal
  url?: string;
  DOI?: string;
  abstractNote?: string;
  tags: Array<{ tag: string }>;
}

export interface ZoteroCollection {
  key: string;
  data: {
    name: string;
    parentCollection?: string;
  };
  meta?: {
    numItems?: number;
  };
}

export interface ZoteroItem {
  key: string;
  version: number;
  data: ZoteroItemData;
  meta?: {
    parsedDate?: string;
  };
}
