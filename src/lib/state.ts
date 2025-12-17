// In-memory state for serverless environments (Vercel)
// Note: This resets on each deployment/function restart
// For persistent state, consider using a database or external storage

export interface SyncState {
    processedKeys: string[];
    lastSync?: string;
}

// In-memory cache
let memoryState: SyncState = {
    processedKeys: [],
};

export async function getSyncState(): Promise<SyncState> {
    // Always use in-memory state for serverless compatibility
    return memoryState;
}

export async function markAsProcessed(itemKey: string): Promise<void> {
    if (!memoryState.processedKeys.includes(itemKey)) {
        memoryState.processedKeys.push(itemKey);
        memoryState.lastSync = new Date().toISOString();
    }
}

export async function clearSyncState(): Promise<void> {
    memoryState = {
        processedKeys: [],
    };
}
