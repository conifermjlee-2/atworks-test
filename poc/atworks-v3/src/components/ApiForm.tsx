"use client";

import { useState, useEffect } from 'react';
import { ApiItem } from '../app/page';

interface ApiFormProps {
  apiItem: ApiItem;
  onSave: () => void;
}

export default function ApiForm({ apiItem, onSave }: ApiFormProps) {
  const [method, setMethod] = useState(apiItem.method);
  const [url, setUrl] = useState(apiItem.url);
  const [name, setName] = useState(apiItem.name);
  const [activeTab, setActiveTab] = useState('Params');
  const [body, setBody] = useState(apiItem.body || '');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const tabs = ['Params', 'Headers', 'Request Body'];

  // Sync state when selected apiItem changes
  useEffect(() => {
    setMethod(apiItem.method);
    setUrl(apiItem.url);
    setName(apiItem.name);
    setBody(apiItem.body || '');
    setResponse(null);
  }, [apiItem]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`http://localhost:3001/apiItems/${apiItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, url, name, body })
      });
      onSave(); // Refresh sidebar data
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!url) {
      setResponse("Please enter a valid URL.");
      return;
    }
    
    setLoading(true);
    setResponse(null);
    try {
      const options: RequestInit = {
        method,
      };
      
      if (method !== 'GET' && method !== 'HEAD') {
        options.body = body;
        options.headers = {
          'Content-Type': 'application/json'
        };
      }

      const res = await fetch(url, options);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setResponse(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 bg-[#202124] text-gray-200">
      {/* Top Bar: Name & Save */}
      <div className="flex justify-between items-center mb-4">
        <input 
          type="text" 
          value={name}
          onChange={e => setName(e.target.value)}
          className="bg-transparent text-xl font-bold focus:outline-none focus:border-b border-gray-600 w-1/2"
          placeholder="API Name"
        />
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="text-sm bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* URL & Method */}
      <div className="flex items-center space-x-2 bg-[#2d2e31] p-2 rounded-lg border border-gray-700">
        <select 
          className="bg-transparent text-blue-400 font-bold focus:outline-none cursor-pointer"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {methods.map(m => (
            <option key={m} value={m} className="bg-[#2d2e31]">{m}</option>
          ))}
        </select>
        <div className="h-6 w-px bg-gray-600 mx-2"></div>
        <input 
          type="text"
          className="flex-1 bg-transparent focus:outline-none font-mono text-sm"
          placeholder="Enter request URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button 
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-6 mt-6 border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 mt-4">
        {activeTab === 'Request Body' ? (
          <textarea
            className="w-full h-48 min-h-[5rem] bg-[#1e1e1e] text-green-400 font-mono text-sm p-4 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-y"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck="false"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-gray-700 rounded text-gray-500 text-sm">
            {activeTab} configuration is not implemented in this mock.
          </div>
        )}
      </div>

      {/* Response Section */}
      <div className="mt-8 border-t border-gray-700 pt-4 flex-1 flex flex-col">
        <h3 className="text-gray-400 text-sm font-semibold mb-2">Response</h3>
        <div className="flex-1 bg-[#1e1e1e] rounded border border-gray-700 p-4 overflow-auto min-h-[200px]">
          {response ? (
            <pre className="text-blue-300 font-mono text-xs whitespace-pre-wrap">
              {response}
            </pre>
          ) : (
            <div className="text-gray-600 text-sm flex items-center justify-center h-full">
              Enter a URL and click Send to get a response
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
