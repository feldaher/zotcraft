import { useState, useEffect } from 'react';
import { ZoteroConfig } from '@/types/zotero';
import { CraftConfig } from '@/types/craft';
import { AIConfig } from '@/types/ai';

export interface AutoSyncConfig {
    enabled: boolean;
    intervalMinutes: number;
}

export interface AppConfig {
    zotero: ZoteroConfig;
    craft: CraftConfig;
    ai: AIConfig;
    autoSync: AutoSyncConfig;
}

const DEFAULT_CONFIG: AppConfig = {
    zotero: { userId: '', apiKey: '', collectionId: '' },
    craft: { apiKey: '', parentDocumentId: '', targetCollectionId: '' },
    ai: { endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-3.5-turbo', enabled: false },
    autoSync: { enabled: false, intervalMinutes: 5 },
};

export function useConfig() {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('zotero2craft_config');
        if (saved) {
            try {
                setConfig(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse config', e);
            }
        }
        setLoaded(true);
    }, []);

    const updateConfig = (newConfig: AppConfig) => {
        setConfig(newConfig);
        localStorage.setItem('zotero2craft_config', JSON.stringify(newConfig));
    };

    return { config, updateConfig, loaded };
}
