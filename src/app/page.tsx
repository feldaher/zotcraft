'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConfig, AppConfig } from '@/hooks/useConfig';
import { ZoteroCollection } from '@/types/zotero';
import { CraftCollection } from '@/types/craft';

export default function Home() {
  const { config, updateConfig, loaded } = useConfig();
  const [logs, setLogs] = useState<Array<{ title: string; status: string; details?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ zotero: boolean; craft: boolean; ai: boolean } | null>(null);

  const [zoteroCollections, setZoteroCollections] = useState<ZoteroCollection[]>([]);
  const [craftCollections, setCraftCollections] = useState<CraftCollection[]>([]);
  const [loadingZoteroCols, setLoadingZoteroCols] = useState(false);
  const [loadingCraftCols, setLoadingCraftCols] = useState(false);

  // Helper to safely update config sections
  const handleChange = (section: keyof AppConfig, field: string, value: any) => {
    updateConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: value,
      },
    });
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
    setLoading(true);
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
      setLoading(false);
    }
  }, [config]);

  // Wrapped in useCallback to be stable for useEffect
  const syncNow = useCallback(async () => {
    setLoading(true);
    setLogs([]);
    try {
      const res = await fetch('/api/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, maxItems: 50 }), // Increased from 10 to 50
      });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      } else if (data.error) {
        alert('Sync failed: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Sync request failed');
    } finally {
      setLoading(false);
    }
  }, [config]); // Re-create when config changes

  // Auto-Sync Polling Logic (Stable Interval)
  const savedSyncNow = useRef(syncNow);
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

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
                  (Zotero: {testResult.zotero ? '✅' : '❌'}, Craft: {testResult.craft ? '✅' : '❌'}, AI: {testResult.ai ? '✅' : '❌'})
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

            {/* AI */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">AI Enrichment</h3>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={config.ai.enabled}
                    onChange={(e) => handleChange('ai', 'enabled', e.target.checked)}
                  />
                  Enable
                </label>
              </div>
              {config.ai.enabled && (
                <>
                  <input
                    type="text"
                    placeholder="Endpoint (e.g. https://api.openai.com/v1)"
                    className="w-full p-2 border rounded text-sm"
                    value={config.ai.endpoint}
                    onChange={(e) => handleChange('ai', 'endpoint', e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="API Key"
                    className="w-full p-2 border rounded text-sm"
                    value={config.ai.apiKey}
                    onChange={(e) => handleChange('ai', 'apiKey', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Model (e.g. gpt-4o)"
                    className="w-full p-2 border rounded text-sm"
                    value={config.ai.model}
                    onChange={(e) => handleChange('ai', 'model', e.target.value)}
                  />
                </>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              <div className="flex gap-4">
                <button
                  onClick={testConnections}
                  disabled={loading}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? 'Testing...' : 'Test Connections'}
                </button>
                <button
                  onClick={syncNow}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex-1 shadow-sm"
                >
                  {loading ? 'Syncing...' : 'Sync Now'}
                </button>
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
