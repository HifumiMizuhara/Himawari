import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { db } from '../services/db';
import { 
  X, Shield, Settings, Database, Eye, EyeOff, Check, AlertCircle, Search, 
  Trash2, Plus, RefreshCw, Globe, Key, HelpCircle
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com',
  claude: 'https://api.anthropic.com',
  deepseek: 'https://api.deepseek.com',
  openrouter: 'https://openrouter.ai/api',
  ollama: 'http://localhost:11434',
  custom: '',
};

const PROVIDER_KEY_LINKS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
  claude: 'https://console.anthropic.com/settings/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  openrouter: 'https://openrouter.ai/keys',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const store = useChatStore();
  const [activeTab, setActiveTab] = useState<'connections' | 'prompt' | 'data'>('connections');
  
  // Left Sidebar State
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');

  // Right Form State
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  
  // Model State
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');

  const activeProvider = store.providers[selectedProviderId] || store.providers.gemini;

  const handleProviderConfigChange = async (key: string, value: any) => {
    await store.updateProvider(selectedProviderId, { [key]: value });
  };

  const handleResetUrl = async () => {
    const defaultUrl = DEFAULT_BASE_URLS[selectedProviderId] || '';
    await handleProviderConfigChange('baseUrl', defaultUrl);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await store.testProviderConnection(selectedProviderId);
      setTestResult(ok ? 'success' : 'failed');
    } catch (_) {
      setTestResult('failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      await store.fetchModelsForProvider(selectedProviderId);
    } catch (err: any) {
      setFetchError(err.message || 'モデル一覧の取得に失敗しました。');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newModelId.trim()) {
      await store.addModelToProvider(selectedProviderId, newModelId.trim());
      setNewModelId('');
      setIsAddingModel(false);
    }
  };

  const handleCreateCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCustomName.trim()) {
      await store.addProvider(newCustomName.trim(), newCustomUrl.trim());
      // Select the newly added provider
      const updatedList = Object.keys(store.providers);
      // Wait a moment for store update
      setTimeout(() => {
        const newId = Object.keys(useChatStore.getState().providers).find(
          (k) => !updatedList.includes(k)
        );
        if (newId) setSelectedProviderId(newId);
      }, 50);

      setNewCustomName('');
      setNewCustomUrl('');
      setIsAddingCustom(false);
    }
  };

  const handleDeleteProvider = async (pId: string, name: string) => {
    if (confirm(`プロバイダー「${name}」を削除しますか？`)) {
      await store.deleteProvider(pId);
      if (selectedProviderId === pId) {
        setSelectedProviderId('gemini');
      }
    }
  };

  // Group models helper
  const groupModels = (models: string[]) => {
    const groups: Record<string, string[]> = {};
    models.forEach((model) => {
      let group = 'other';
      if (model.includes('/')) {
        group = model.split('/')[0];
      } else if (model.includes(':')) {
        group = model.split(':')[0];
      } else if (model.startsWith('gpt-') || model.startsWith('o1-')) {
        group = 'OpenAI';
      } else if (model.startsWith('claude-')) {
        group = 'Anthropic';
      } else if (model.startsWith('gemini-')) {
        group = 'Google';
      } else if (model.startsWith('deepseek-')) {
        group = 'DeepSeek';
      } else {
        const firstPart = model.split('-')[0];
        if (firstPart && firstPart.length > 2) {
          group = firstPart;
        }
      }
      
      const normalizedGroup = group.charAt(0).toUpperCase() + group.slice(1);
      if (!groups[normalizedGroup]) groups[normalizedGroup] = [];
      groups[normalizedGroup].push(model);
    });

    return groups;
  };

  // Get filtered providers
  const getFilteredProviders = () => {
    return Object.values(store.providers).filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredProviders = getFilteredProviders();
  const groupedModels = groupModels(activeProvider.models);

  // Data Export/Import
  const handleExportData = async () => {
    try {
      const chats = await db.chats.toArray();
      const messages = await db.messages.toArray();
      const exportObj = { version: '1.0.0', exporter: 'Minase AI Chat', chats, messages };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minase-chats-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('エクスポートに失敗しました。');
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
            alert('ファイル形式が無効です。');
            return;
          }
          await db.transaction('rw', [db.chats, db.messages], async () => {
            for (const chat of importObj.chats) await db.chats.put(chat);
            for (const message of importObj.messages) await db.messages.put(message);
          });
          await store.loadChats();
          alert('インポートが完了しました。');
        } catch (_) {
          alert('解析エラー。');
        }
      };
      reader.readAsText(file);
    } catch (_) {
      alert('ファイルの読み込みに失敗しました。');
    }
  };

  const handleClearAll = async () => {
    if (confirm('すべての会話データを削除しますか？')) {
      await store.clearAllChats();
      alert('履歴が削除されました。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative flex flex-col w-full max-w-4xl h-[650px] bg-bg-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-card-light/45 dark:bg-sidebar-dark/30 shrink-0">
          <div className="flex items-center space-x-2 text-gray-900 dark:text-gray-100 font-semibold text-md">
            <Settings className="w-5 h-5" />
            <span>設定</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Main settings tabs (Leftmost strip) */}
          <div className="w-16 md:w-44 bg-card-light dark:bg-sidebar-dark/45 border-r border-border-light dark:border-border-dark flex flex-col py-4 space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab('connections')}
              className={`flex flex-col md:flex-row items-center md:space-x-2.5 px-3 py-2.5 text-center md:text-left transition-colors cursor-pointer text-xs md:text-sm font-semibold border-l-2 ${
                activeTab === 'connections'
                  ? 'border-accent-blue bg-border-light/50 dark:bg-border-dark/50 text-accent-blue'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-border-light/20 dark:hover:bg-border-dark/20'
              }`}
            >
              <Key className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">接続設定 (API)</span>
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex flex-col md:flex-row items-center md:space-x-2.5 px-3 py-2.5 text-center md:text-left transition-colors cursor-pointer text-xs md:text-sm font-semibold border-l-2 ${
                activeTab === 'prompt'
                  ? 'border-accent-blue bg-border-light/50 dark:bg-border-dark/50 text-accent-blue'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-border-light/20 dark:hover:bg-border-dark/20'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">システムプロンプト</span>
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`flex flex-col md:flex-row items-center md:space-x-2.5 px-3 py-2.5 text-center md:text-left transition-colors cursor-pointer text-xs md:text-sm font-semibold border-l-2 ${
                activeTab === 'data'
                  ? 'border-accent-blue bg-border-light/50 dark:bg-border-dark/50 text-accent-blue'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-border-light/20 dark:hover:bg-border-dark/20'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">データ管理</span>
            </button>
          </div>

          {/* Form Content pane */}
          <div className="flex-1 flex overflow-hidden bg-bg-light dark:bg-bg-dark text-gray-800 dark:text-gray-100">
            
            {activeTab === 'connections' && (
              /* Connections 2-Column pane */
              <div className="flex-1 flex overflow-hidden">
                
                {/* Connections Column 1: Providers List (Width: 1/3) */}
                <div className="w-64 border-r border-border-light dark:border-border-dark flex flex-col bg-card-light/20 dark:bg-sidebar-dark/10 h-full shrink-0 select-none">
                  
                  {/* Search providers box */}
                  <div className="p-3 border-b border-border-light dark:border-border-dark relative shrink-0">
                    <input
                      type="text"
                      placeholder="プロバイダーを検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-card-light dark:bg-sidebar-dark text-xs border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                    <Search className="absolute left-5 top-[19px] w-3.5 h-3.5 text-gray-400" />
                  </div>

                  {/* Scrollable list of providers */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {filteredProviders.map((p) => {
                      const isSelected = selectedProviderId === p.id;
                      const isCustom = p.id.startsWith('custom_');

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProviderId(p.id);
                            setTestResult(null);
                            setFetchError(null);
                          }}
                          className={`group flex items-center justify-between w-full px-2.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-border-light/75 dark:bg-border-dark/75 text-accent-blue'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-border-light/35 dark:hover:bg-border-dark/35 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 shrink-0 max-w-[80%]">
                            {/* Brand dot indicator */}
                            <span 
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                p.enabled ? 'bg-accent-green' : 'bg-gray-300 dark:bg-gray-600'
                              }`} 
                            />
                            <span className="truncate">{p.name}</span>
                          </div>

                          {/* Delete custom provider option */}
                          {isCustom && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProvider(p.id, p.name);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 rounded cursor-pointer transition-opacity z-10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add provider form / button at bottom */}
                  <div className="p-3 border-t border-border-light dark:border-border-dark shrink-0">
                    {isAddingCustom ? (
                      <form onSubmit={handleCreateCustomProvider} className="space-y-2 animate-scale-up">
                        <input
                          type="text"
                          required
                          placeholder="プロバイダー名"
                          value={newCustomName}
                          onChange={(e) => setNewCustomName(e.target.value)}
                          className="w-full px-2 py-1 bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded text-xs focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="ベースURL (例: http://...)"
                          value={newCustomUrl}
                          onChange={(e) => setNewCustomUrl(e.target.value)}
                          className="w-full px-2 py-1 bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded text-xs focus:outline-none"
                        />
                        <div className="flex space-x-1.5">
                          <button
                            type="submit"
                            className="flex-1 py-1 bg-accent-blue hover:bg-accent-blue/90 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingCustom(false)}
                            className="flex-1 py-1 bg-gray-200 dark:bg-card-dark text-gray-700 dark:text-gray-300 rounded text-[10px] font-bold cursor-pointer"
                          >
                            閉じる
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setIsAddingCustom(true)}
                        className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 border border-dashed border-border-light dark:border-border-dark hover:bg-border-light/30 dark:hover:bg-border-dark/30 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>プロバイダーを追加</span>
                      </button>
                    )}
                  </div>

                </div>

                {/* Connections Column 2: Provider detail Form (Width: 2/3) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 h-full">
                  
                  {/* Top Bar Header with switch */}
                  <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-3 select-none">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{activeProvider.name}</span>
                      <span title="API接続を設定してモデルを取得します。">
                        <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                      </span>
                    </div>
                    
                    {/* On/Off Switch */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">{activeProvider.enabled ? '有効' : '無効'}</span>
                      <button
                        onClick={() => handleProviderConfigChange('enabled', !activeProvider.enabled)}
                        className={`w-10 h-5.5 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${
                          activeProvider.enabled ? 'bg-accent-green' : 'bg-gray-200 dark:bg-card-dark'
                        }`}
                      >
                        <div 
                          className={`w-4.5 h-4.5 bg-white rounded-full shadow-sm transform transition-transform ${
                            activeProvider.enabled ? 'translate-x-4.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* API Key Box */}
                  {selectedProviderId !== 'ollama' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">APIキー</label>
                        
                        {/* Get Key Link */}
                        {PROVIDER_KEY_LINKS[selectedProviderId] && (
                          <a
                            href={PROVIDER_KEY_LINKS[selectedProviderId]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent-blue hover:underline cursor-pointer"
                          >
                            APIキーを取得
                          </a>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={activeProvider.apiKey}
                            onChange={(e) => handleProviderConfigChange('apiKey', e.target.value)}
                            placeholder="********************************"
                            className="w-full pl-3 pr-10 py-1.5 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:border-accent-blue dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                          >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        
                        {/* Check button */}
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={isTesting}
                          className="px-3.5 py-1.5 bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark hover:bg-border-light/45 dark:hover:bg-border-dark/45 text-xs font-bold rounded-lg cursor-pointer transition-colors shrink-0 flex items-center space-x-1.5"
                        >
                          {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          <span>チェック</span>
                        </button>
                      </div>

                      {/* Check result feedback */}
                      {testResult && (
                        <div className="flex items-center text-xs space-x-1 mt-1">
                          {testResult === 'success' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-accent-green" />
                              <span className="text-accent-green font-medium">接続テスト成功！キーは有効です。</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-red-500 font-medium">接続テスト失敗。キーまたはネットワークを確認してください。</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* API Host Box */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">APIホスト</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={activeProvider.baseUrl}
                        onChange={(e) => handleProviderConfigChange('baseUrl', e.target.value)}
                        placeholder="http://localhost:port"
                        className="flex-1 px-3 py-1.5 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:border-accent-blue dark:text-gray-100"
                      />
                      
                      {/* Reset Button */}
                      <button
                        type="button"
                        onClick={handleResetUrl}
                        className="px-3 py-1.5 bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark hover:bg-border-light/45 dark:hover:bg-border-dark/45 text-xs text-red-500 dark:text-red-400 font-bold rounded-lg cursor-pointer transition-colors shrink-0"
                      >
                        リセット
                      </button>
                    </div>

                    {/* Host Compile Preview */}
                    <p className="text-[10px] text-gray-400 leading-tight">
                      プレビュー：
                      <span className="font-mono bg-card-light dark:bg-sidebar-dark px-1 py-0.5 rounded ml-1 text-gray-500 dark:text-gray-300 select-all">
                        {activeProvider.baseUrl || 'Base URL empty'}
                        {activeProvider.id === 'gemini' 
                          ? '/v1beta/models/...:streamGenerateContent' 
                          : activeProvider.id === 'ollama' 
                          ? '/api/chat' 
                          : '/v1/chat/completions'}
                      </span>
                    </p>
                  </div>

                  {/* CORS Proxy Override field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center">
                      <span>CORS プロキシ URL</span>
                      <span className="ml-1 text-[10px] text-gray-400 font-normal">(必要な場合に入力)</span>
                    </label>
                    <input
                      type="text"
                      value={activeProvider.corsProxy}
                      onChange={(e) => handleProviderConfigChange('corsProxy', e.target.value)}
                      placeholder="例: https://cors-anywhere.herokuapp.com/"
                      className="w-full px-3 py-1.5 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:border-accent-blue dark:text-gray-100"
                    />
                  </div>

                  {/* Models grouped section */}
                  <div className="space-y-3 pt-2 border-t border-border-light dark:border-border-dark">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          モデル
                        </span>
                        <span className="px-1.5 py-0.5 bg-border-light/70 dark:bg-border-dark/70 text-gray-600 dark:text-gray-400 font-bold font-mono text-[10px] rounded-md">
                          {activeProvider.models.length}
                        </span>
                      </div>

                      <div className="flex space-x-1.5 select-none shrink-0">
                        {/* Add custom model toggle button */}
                        <button
                          type="button"
                          onClick={() => setIsAddingModel(!isAddingModel)}
                          className="p-1 border border-border-light dark:border-border-dark hover:bg-border-light/45 dark:hover:bg-border-dark/45 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors cursor-pointer"
                          title="手動でモデルを追加"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Fetch models button */}
                        <button
                          type="button"
                          onClick={handleFetchModels}
                          disabled={isFetchingModels}
                          className="px-2.5 py-1 bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark hover:bg-border-light/45 dark:hover:bg-border-dark/45 text-[11px] font-bold rounded-lg cursor-pointer transition-colors flex items-center space-x-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                          <span>モデルリストを取得</span>
                        </button>
                      </div>
                    </div>

                    {/* Add custom model inline input */}
                    {isAddingModel && (
                      <form onSubmit={handleAddCustomModel} className="flex space-x-2 animate-scale-up bg-card-light/45 dark:bg-sidebar-dark/40 p-2.5 rounded-lg border border-border-light dark:border-border-dark">
                        <input
                          type="text"
                          required
                          placeholder="モデルIDを入力 (例: gpt-4o-mini)"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-bg-light dark:bg-bg-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:border-accent-blue"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 bg-accent-blue text-white rounded-md text-xs font-bold cursor-pointer"
                        >
                          追加
                        </button>
                      </form>
                    )}

                    {/* Fetch error display */}
                    {fetchError && (
                      <div className="flex items-start text-[11px] text-red-500 space-x-1 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg leading-tight">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{fetchError}</span>
                      </div>
                    )}

                    {/* Grouped list of models */}
                    <div className="space-y-3.5 max-h-[170px] overflow-y-auto p-1 border border-border-light/50 dark:border-border-dark/50 rounded-xl bg-card-light/10 dark:bg-sidebar-dark/5">
                      {activeProvider.models.length === 0 ? (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-6">
                          モデルリストが空です。「モデルリストを取得」ボタンを押してロードしてください。
                        </p>
                      ) : (
                        Object.entries(groupedModels).map(([groupName, mList]) => (
                          <div key={groupName} className="space-y-1">
                            {/* Group name sub-header */}
                            <div className="px-2 py-0.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-border-light/35 dark:border-border-dark/35 select-none bg-card-light/20 dark:bg-sidebar-dark/20 rounded">
                              {groupName}
                            </div>
                            
                            {/* Models rows */}
                            <div className="space-y-0.5 pl-1.5">
                              {mList.map((mId) => (
                                <div
                                  key={mId}
                                  className="group flex items-center justify-between py-1 px-2 hover:bg-border-light/30 dark:hover:bg-border-dark/30 rounded-md transition-colors"
                                >
                                  <div className="flex items-center space-x-2 truncate pr-4">
                                    {/* Small visual brand icon mock */}
                                    <Globe className={`w-3.5 h-3.5 shrink-0 ${
                                      selectedProviderId === 'gemini' ? 'text-blue-500' :
                                      selectedProviderId === 'openai' ? 'text-accent-green' :
                                      selectedProviderId === 'claude' ? 'text-amber-600' :
                                      'text-gray-400'
                                    }`} />
                                    <span className="text-xs font-mono truncate select-all">{mId}</span>
                                  </div>

                                  {/* Delete model from provider list */}
                                  <button
                                    onClick={() => store.removeModelFromProvider(selectedProviderId, mId)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 text-gray-400 dark:text-gray-500 rounded cursor-pointer transition-opacity"
                                    title="このモデルを削除"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="flex-1 p-6 space-y-4">
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
                    className="w-full px-3 py-2 text-sm bg-card-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:border-accent-blue dark:text-gray-100 font-sans resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="flex-1 p-6 space-y-6">
                
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
