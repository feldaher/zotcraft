'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ZoteroConfig, ZoteroCollection } from '@/types/zotero';
import { CraftConfig, CraftCollection } from '@/types/craft';

// Simple Button Component for consistency
const Button = ({ children, disabled, onClick, variant = 'primary', className = '' }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'outline'
      ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${className}`}
  >
    {children}
  </button>
);

export default function Home() {
  const [config, setConfig] = useState<{
    zotero: ZoteroConfig;
    craft: CraftConfig;
    autoSync?: { enabled: boolean; intervalMinutes: number };
  }>({
    zotero: { apiKey: '', userId: '', collectionId: '' },
    craft: { apiKey: '', spaceId: '', parentDocumentId: '', targetCollectionId: '' },
    autoSync: { enabled: false, intervalMinutes: 60 },
  });

  const [loaded, setLoaded] = useState(false); // Track if config is loaded from storage

  // State Definitions
  const [logs, setLogs] = useState<Array<{ title: string; status: string; details?: string }>>([]);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ zotero: boolean; craft: boolean } | null>(null);

  const [zoteroCollections, setZoteroCollections] = useState<ZoteroCollection[]>([]);
  const [craftCollections, setCraftCollections] = useState<CraftCollection[]>([]);
  const [loadingZoteroCols, setLoadingZoteroCols] = useState(false);
  const [loadingCraftCols, setLoadingCraftCols] = useState(false);

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);

  // Abort controller ref to cancel sync
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('zotero2craft_config');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem('zotero2craft_config', JSON.stringify(config));
    }
  }, [config, loaded]);

  // Helper to safely update config sections
  const handleChange = (section: keyof typeof config, field: string, value: any) => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        [field]: value,
      },
    }));
  };

  // Fetch Zotero Collections
  const fetchZoteroCollections = useCallback(async () => {
    if (!config.zotero.userId || !config.zotero.apiKey) return;
    setLoadingZoteroCols(true);
    try {
      const res = await fetch('/api/zotero/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.zotero),
      });
      if (res.ok) {
        const data = await res.json();
        setZoteroCollections(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingZoteroCols(false);
    }
  }, [config.zotero.userId, config.zotero.apiKey]); // Only depend on credentials

  // Fetch Craft Collections
  const fetchCraftCollections = useCallback(async () => {
    if (!config.craft.apiKey) return;
    setLoadingCraftCols(true);
    try {
      const res = await fetch('/api/craft/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.craft),
      });
      if (res.ok) {
        const data = await res.json();
        setCraftCollections(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCraftCols(false);
    }
  }, [config.craft.apiKey]);

  const testConnections = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestResult(data);
    } finally {
      setTesting(false);
    }
  }, [config]);

  // Cancel sync function
  const stopSync = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setSyncing(false);
      setLogs((prev) => [{ title: 'Sync Stopped', status: 'warning', details: 'User cancelled the operation' }, ...prev]);
    }
  }, []);

  // Wrapped in useCallback to be stable for useEffect
  const syncNow = useCallback(async () => {
    if (syncing) return;

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSyncing(true);
    setLogs([]); // Clear logs

    try {
      const res = await fetch('/api/sync-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          maxItems: 50, // Process more items
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(res.statusText);

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        buffer += text;

        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const logEntry = JSON.parse(line);
            setLogs((prev) => [logEntry, ...prev]);
          } catch (e) {
            console.error('Error parsing stream line:', line, e);
          }
        }
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Sync aborted');
      } else {
        console.error('Sync failed:', e);
        setLogs((prev) => [{ title: 'Sync Failure', status: 'error', details: e.message }, ...prev]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setSyncing(false);
        setLastSyncTime(new Date());
        abortControllerRef.current = null;
      }
    }
  }, [config, syncing]); // Re-create when config changes

  // Auto-Sync Polling Logic (Stable Interval)
  const savedSyncNow = useRef(syncNow);

  // Keep ref updated with latest syncNow function
  useEffect(() => {
    savedSyncNow.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    if (config.autoSync?.enabled && config.autoSync.intervalMinutes > 0) {
      const delay = config.autoSync.intervalMinutes * 60 * 1000;
      console.log(`Auto-sync enabled. Next sync in ${config.autoSync.intervalMinutes} minutes.`);

      setNextSyncTime(new Date(Date.now() + delay));

      const tick = () => {
        console.log('Auto-sync tick...');
        setLastSyncTime(new Date());
        setNextSyncTime(new Date(Date.now() + delay));
        savedSyncNow.current();
      };

      const id = setInterval(tick, delay);

      return () => {
        clearInterval(id);
        setNextSyncTime(null);
      };
    } else {
      setNextSyncTime(null);
    }
  }, [config.autoSync?.enabled, config.autoSync?.intervalMinutes]);

  if (!loaded) return <div className="p-10">Loading configuration...</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Zotero to Craft Sync</h1>
          <p className="text-gray-500 mt-2">Automated literature notes creation with AI summarization.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Connections Panel */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Connections
              {testResult && (
                <span className="text-xs font-normal">
                  (Zotero: {testResult.zotero ? '✅' : '❌'}, Craft: {testResult.craft ? '✅' : '❌'})
                </span>
              )}
            </h2>

            {/* Zotero */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Zotero</h3>
              <input
                type="text"
                placeholder="User ID"
                className="w-full p-2 border rounded text-sm"
                value={config.zotero.userId}
                onChange={(e) => handleChange('zotero', 'userId', e.target.value)}
              />
              <input
                type="password"
                placeholder="API Key"
                className="w-full p-2 border rounded text-sm"
                value={config.zotero.apiKey}
                onChange={(e) => handleChange('zotero', 'apiKey', e.target.value)}
                onBlur={fetchZoteroCollections} // Fetch when done typing
              />

              <div className="flex gap-2">
                {zoteroCollections.length > 0 ? (
                  <select
                    className="w-full p-2 border rounded text-sm bg-white"
                    value={config.zotero.collectionId}
                    onChange={(e) => handleChange('zotero', 'collectionId', e.target.value)}
                  >
                    <option value="">Select Collection</option>
                    {zoteroCollections.map(col => (
                      <option key={col.key} value={col.key}>{col.data.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Collection ID"
                    className="w-full p-2 border rounded text-sm"
                    value={config.zotero.collectionId}
                    onChange={(e) => handleChange('zotero', 'collectionId', e.target.value)}
                  />
                )}
                <button
                  onClick={fetchZoteroCollections}
                  className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-xs whitespace-nowrap"
                  disabled={loadingZoteroCols}
                >
                  {loadingZoteroCols ? '...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Craft */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700">Craft</h3>
              <input
                type="password"
                placeholder="API Key"
                className="w-full p-2 border rounded text-sm"
                value={config.craft.apiKey}
                onChange={(e) => handleChange('craft', 'apiKey', e.target.value)}
                onBlur={fetchCraftCollections}
              />

              {/* Collection Dropdown */}
              <div className="flex gap-2">
                <div className="w-full">
                  {craftCollections.length > 0 ? (
                    <select
                      className="w-full p-2 border rounded text-sm bg-white"
                      value={config.craft.targetCollectionId || ''}
                      onChange={(e) => handleChange('craft', 'targetCollectionId', e.target.value)}
                    >
                      <option value="">Select Target Collection (Optional)</option>
                      {craftCollections.map(col => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-gray-500 p-2 border rounded bg-gray-50">
                      {loadingCraftCols ? 'Loading collections...' : 'No collections loaded. Enter key & refresh.'}
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchCraftCollections}
                  className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-xs whitespace-nowrap h-fit self-center"
                  disabled={loadingCraftCols}
                >
                  {loadingCraftCols ? '...' : 'Refresh'}
                </button>
              </div>

              {!config.craft.targetCollectionId && (
                <div>
                  <input
                    type="text"
                    placeholder="Parent Document ID (Fallback)"
                    className="w-full p-2 border rounded text-sm"
                    value={config.craft.parentDocumentId}
                    onChange={(e) => handleChange('craft', 'parentDocumentId', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">If no collection is selected, notes will be created as sub-pages here.</p>
                </div>
              )}
            </div>

            {/* Auto-Sync */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Auto-Sync (Polling)</h3>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={config.autoSync?.enabled || false}
                    onChange={(e) => handleChange('autoSync', 'enabled', e.target.checked)}
                  />
                  Enable
                </label>
              </div>
              {config.autoSync?.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Interval:</span>
                  <select
                    className="p-1 border rounded text-sm bg-white"
                    value={config.autoSync.intervalMinutes}
                    onChange={(e) => handleChange('autoSync', 'intervalMinutes', parseInt(e.target.value))}
                  >
                    <option value={1}>1 Minute</option>
                    <option value={5}>5 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                  </select>
                  <span className="text-xs text-green-600 ml-auto animate-pulse flex flex-col items-end">
                    <span>● Active</span>
                    {nextSyncTime && <span className="text-[10px] text-gray-400 font-normal">Next: {nextSyncTime.toLocaleTimeString()}</span>}
                    {lastSyncTime && <span className="text-[10px] text-gray-400 font-normal">Last: {lastSyncTime.toLocaleTimeString()}</span>}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Actions Panel */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              <div className="space-y-4">
                <div className="flex gap-4 items-center flex-wrap">
                  <Button
                    onClick={testConnections}
                    variant="outline"
                    disabled={testing || syncing || !config.zotero.apiKey || !config.craft.apiKey}
                  >
                    {testing ? 'Testing...' : 'Test Connections'}
                  </Button>

                  {syncing ? (
                    <Button
                      onClick={stopSync}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Stop Sync
                    </Button>
                  ) : (
                    <Button
                      onClick={syncNow}
                      disabled={testing || !config.zotero.apiKey || !config.craft.apiKey}
                    >
                      Sync Now
                    </Button>
                  )}
                </div>

                {testResult && (
                  <div className="flex gap-4 text-sm">
                    {testResult.zotero ? (
                      <span className="text-green-600">✅ Zotero Connected</span>
                    ) : (
                      <span className="text-red-600">❌ Zotero Not Connected</span>
                    )}
                    {testResult.craft ? (
                      <span className="text-green-600">✅ Craft Connected</span>
                    ) : (
                      <span className="text-red-600">❌ Craft Not Connected</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] overflow-hidden flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Activity Log</h2>
              <div className="flex-1 overflow-y-auto space-y-2 text-sm bg-gray-50 p-4 rounded-lg">
                {logs.length === 0 ? (
                  <p className="text-gray-400 italic text-center text-xs mt-10">Sync activity will appear here...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <span className={`
                        text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mt-0.5
                        ${log.status === 'created' ? 'bg-green-100 text-green-700' : ''}
                        ${log.status === 'error' ? 'bg-red-100 text-red-700' : ''}
                        ${log.status === 'skipped' ? 'bg-gray-100 text-gray-600' : ''}
                      `}>
                        {log.status}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{log.title}</p>
                        {log.details && <p className="text-gray-500 text-xs mt-0.5">{log.details}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
