import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { db } from '../services/db';
import { X, Key, Shield, Settings, Database, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const store = useChatStore();
  const [activeTab, setActiveTab] = useState<'connections' | 'prompt' | 'data'>('connections');
  
  // Selected provider to configure in dropdown
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  
  // Show/hide API key toggle
  const [showKey, setShowKey] = useState(false);
  
  // Fetching state
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState(false);

  const activeProvider = store.providers[selectedProviderId] || store.providers.gemini;

  const handleProviderConfigChange = async (key: string, value: any) => {
    await store.updateProvider(selectedProviderId, { [key]: value });
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchError(null);
    setFetchSuccess(false);
    
    try {
      await store.fetchModelsForProvider(selectedProviderId);
      setFetchSuccess(true);
      setTimeout(() => setFetchSuccess(false), 3000);
    } catch (err: any) {
      setFetchError(err.message || 'モデルリストの取得に失敗しました。キーや接続先、CORSプロキシの設定を確認してください。');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleExportData = async () => {
    try {
      const chats = await db.chats.toArray();
      const messages = await db.messages.toArray();
      
      const exportObj = {
        version: '1.0.0',
        exporter: 'Minase AI Chat',
        exportDate: Date.now(),
        chats,
        messages,
      };

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minase-chats-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('データのエクスポートに失敗しました。');
      console.error(error);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const importObj = JSON.parse(evt.target?.result as string);
          if (!importObj.chats || !importObj.messages) {
            alert('無効なファイル形式です。MinaseのエクスポートJSONファイルを選択してください。');
            return;
          }

          await db.transaction('rw', [db.chats, db.messages], async () => {
            for (const chat of importObj.chats) {
              await db.chats.put(chat);
            }
            for (const message of importObj.messages) {
              await db.messages.put(message);
            }
          });

          await store.loadChats();
          if (store.activeChatId) {
            await store.selectChat(store.activeChatId);
          }
          alert('データを正常にインポートしました！');
        } catch (err) {
          alert('JSONの解析に失敗しました。');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      alert('ファイルの読み込みに失敗しました。');
    }
  };

  const handleClearAll = async () => {
    if (confirm('すべてのチャット履歴と設定データを削除しますか？この操作は取り消せません。')) {
      await store.clearAllChats();
      alert('すべてのチャット履歴が消去されました。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative flex flex-col w-full max-w-2xl h-[570px] bg-bg-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center space-x-2 text-gray-900 dark:text-gray-100 font-semibold text-lg">
            <Settings className="w-5 h-5" />
            <span>設定</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-card-light dark:bg-sidebar-dark/40 border-r border-border-light dark:border-border-dark py-4 flex flex-col space-y-1">
            <button
              onClick={() => setActiveTab('connections')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm text-left transition-colors cursor-pointer font-medium ${
                activeTab === 'connections'
                  ? 'bg-border-light/50 dark:bg-border-dark/50 text-accent-blue border-l-2 border-accent-blue'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-border-light/30 dark:hover:bg-border-dark/30 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>接続設定 (API)</span>
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm text-left transition-colors cursor-pointer font-medium ${
                activeTab === 'prompt'
                  ? 'bg-border-light/50 dark:bg-border-dark/50 text-accent-blue border-l-2 border-accent-blue'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-border-light/30 dark:hover:bg-border-dark/30 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>システムプロンプト</span>
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm text-left transition-colors cursor-pointer font-medium ${
                activeTab === 'data'
                  ? 'bg-border-light/50 dark:bg-border-dark/50 text-accent-blue border-l-2 border-accent-blue'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-border-light/30 dark:hover:bg-border-dark/30 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>データ・一般設定</span>
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-bg-light dark:bg-bg-dark">
            {activeTab === 'connections' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2">プロバイダーの接続管理</h3>
                
                {/* Selector Dropdown */}
                <div className="space-y-1 bg-card-light/45 dark:bg-sidebar-dark/40 p-3 rounded-lg border border-border-light dark:border-border-dark">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">プロバイダーを選択してください</label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => {
                      setSelectedProviderId(e.target.value);
                      setFetchError(null);
                      setFetchSuccess(false);
                    }}
                    className="w-full px-3 py-2 text-sm bg-bg-light dark:bg-bg-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue dark:text-gray-100 font-medium"
                  >
                    {Object.values(store.providers).map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.name} {prov.enabled ? '(有効)' : '(無効)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Provider Form Fields */}
                <div className="space-y-3 pt-2">
                  
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      このプロバイダーをチャットで有効にする
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeProvider.enabled}
                        onChange={(e) => handleProviderConfigChange('enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 dark:bg-card-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-accent-blue"></div>
                    </label>
                  </div>

                  {/* API Key (Optional for Ollama, required for others) */}
                  {selectedProviderId !== 'ollama' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {activeProvider.name === 'Custom Provider' ? 'API キー (必要な場合)' : 'API キー'}
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={activeProvider.apiKey}
                          onChange={(e) => handleProviderConfigChange('apiKey', e.target.value)}
                          placeholder={`${activeProvider.id === 'gemini' ? 'AIzaSy...' : activeProvider.id === 'openai' ? 'sk-...' : 'APIキーを入力'}`}
                          className="w-full px-3 py-2 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue dark:text-gray-100"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Base URL (Optional/Editable) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      ベース URL
                    </label>
                    <input
                      type="text"
                      value={activeProvider.baseUrl}
                      onChange={(e) => handleProviderConfigChange('baseUrl', e.target.value)}
                      placeholder="https://api.example.com"
                      className="w-full px-3 py-2 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue dark:text-gray-100"
                    />
                  </div>

                  {/* CORS Proxy URL */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      CORS プロキシ URL (このプロバイダー専用)
                    </label>
                    <input
                      type="text"
                      value={activeProvider.corsProxy}
                      onChange={(e) => handleProviderConfigChange('corsProxy', e.target.value)}
                      placeholder="プロバイダー固有のCORS回避プロキシがある場合に入力"
                      className="w-full px-3 py-2 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue dark:text-gray-100"
                    />
                  </div>

                  {/* Model Management Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        モデルリスト (カンマ区切り)
                      </label>
                      <button
                        type="button"
                        onClick={handleFetchModels}
                        disabled={isFetchingModels}
                        className={`text-xs px-2.5 py-1 font-semibold rounded-md border text-white transition-colors cursor-pointer ${
                          isFetchingModels 
                            ? 'bg-gray-400 border-gray-400 dark:bg-gray-700 dark:border-gray-700 cursor-not-allowed'
                            : 'bg-accent-blue hover:bg-accent-blue/90 border-accent-blue'
                        }`}
                      >
                        {isFetchingModels ? '取得中...' : 'モデルリストを取得'}
                      </button>
                    </div>
                    
                    <textarea
                      rows={3}
                      value={activeProvider.models.join(', ')}
                      onChange={(e) => {
                        const list = e.target.value
                          .split(',')
                          .map((m) => m.trim())
                          .filter((m) => m.length > 0);
                        handleProviderConfigChange('models', list);
                      }}
                      placeholder="モデル名がありません。取得ボタンを押すか、直接入力してください。"
                      className="w-full px-3 py-2 text-xs bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue dark:text-gray-100 font-mono resize-none"
                    />
                    
                    {/* Fetch feedback */}
                    {fetchSuccess && (
                      <div className="flex items-center text-xs text-accent-green space-x-1 mt-1 font-sans">
                        <Check className="w-3.5 h-3.5" />
                        <span>モデルリストを取得し、保存しました！</span>
                      </div>
                    )}
                    {fetchError && (
                      <div className="flex items-start text-[11px] text-red-500 space-x-1 mt-1 font-sans leading-tight bg-red-500/10 border border-red-500/20 p-2 rounded-md">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{fetchError}</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2">グローバルシステムプロンプト</h3>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                    すべての新しいチャットスレッドのデフォルトアシスタント人格を決定します。特定のチャットで変更することも可能です。
                  </p>
                  <textarea
                    rows={12}
                    value={store.globalSystemPrompt}
                    onChange={(e) => store.updateSetting('globalSystemPrompt', e.target.value)}
                    placeholder="例: あなたは親切なプログラミングアシスタントです。常に日本語で簡潔に回答し、コード例を提示してください。"
                    className="w-full px-3 py-2 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue dark:text-gray-100 font-sans resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                
                {/* Theme Selection */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">カラーテーマ</h3>
                  <div className="flex space-x-2">
                    {(['light', 'dark', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => store.updateSetting('theme', t)}
                        className={`flex-1 px-3 py-2 text-sm font-medium border rounded-md transition-colors cursor-pointer capitalize ${
                          store.theme === t
                            ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                            : 'bg-card-light dark:bg-sidebar-dark border-border-light dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-border-light/30 dark:hover:bg-border-dark/30'
                        }`}
                      >
                        {t === 'light' ? 'ライト' : t === 'dark' ? 'ダーク' : 'システム同期'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Import / Export & Clear */}
                <div className="space-y-3 border-t border-border-light dark:border-border-dark pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">データの管理</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleExportData}
                      className="px-4 py-2.5 text-sm font-medium border border-border-light dark:border-border-dark bg-card-light dark:bg-sidebar-dark text-gray-700 dark:text-gray-300 rounded-md hover:bg-border-light/30 dark:hover:bg-border-dark/30 transition-colors cursor-pointer"
                    >
                      会話履歴のエクスポート (.json)
                    </button>
                    
                    <label className="flex items-center justify-center px-4 py-2.5 text-sm font-medium border border-border-light dark:border-border-dark bg-card-light dark:bg-sidebar-dark text-gray-700 dark:text-gray-300 rounded-md hover:bg-border-light/30 dark:hover:bg-border-dark/30 transition-colors cursor-pointer relative">
                      <span>会話履歴のインポート</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportData}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  <div className="border-t border-border-light dark:border-border-dark pt-4 mt-2">
                    <button
                      onClick={handleClearAll}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer"
                    >
                      すべてのチャット履歴を削除する
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">
                      ※この操作を行うと、ブラウザ内に保存されたすべてのメッセージ・添付ファイルが完全に消去されます。
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
