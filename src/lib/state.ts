import fs from 'fs/promises';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), 'state.json');

export interface SyncState {
    processedKeys: string[];
    lastSync?: string;
}

export async function getSyncState(): Promise<SyncState> {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return empty state
        return { processedKeys: [] };
    }
}

export async function saveSyncState(state: SyncState): Promise<void> {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function markAsProcessed(key: string): Promise<void> {
    const state = await getSyncState();
    if (!state.processedKeys.includes(key)) {
        state.processedKeys.push(key);
        state.lastSync = new Date().toISOString();
        await saveSyncState(state);
    }
}
