'use client';

import { useState } from 'react';

interface ChatInterfaceProps {
  orgName: string;
  userInfo: any;
  onSignOut: () => void;
  onReset: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface({ orgName, userInfo, onSignOut, onReset }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Support-Coordinator');
  const [targetUrl, setTargetUrl] = useState('https://kong-gateway-proxy-url.com/chat');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    const newUserMessage = { role: 'user' as const, content: userMessage };
    
    setInputMessage('');
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const accessToken = sessionStorage.getItem('access-token') || '';
      const url = targetUrl;
      
      console.log("Target URL:", url);
      console.log("Model:", selectedModel);
      console.log("Body:", JSON.stringify({ messages: [newUserMessage] }));

      // Use the Next.js API route as a proxy to avoid CORS issues
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-agent-type": selectedModel,
        "x-target-url": url, // Pass the Kong URL to the proxy
      };

      // Add authorization header if access token is provided
      if (accessToken.trim()) {
        headers["Authorization"] = `Bearer ${accessToken.trim()}`;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [newUserMessage],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      console.log("Response data:", data);
      
      // Parse the response from Kong Gateway (OpenAI format)
      const assistantMessage = data.choices?.[0]?.message?.content || data.response || data.message || 'No response';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response. Please try again.'}` 
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Chat</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chat with AI powered by {selectedModel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {userInfo?.username || userInfo?.email || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {orgName}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSignOut}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Sign Out
              </button>
              <button
                onClick={onReset}
                className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="max-w-4xl mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col">
        {/* Configuration Section */}
        <div className="mb-4 space-y-4">
          {/* Model Selection */}
          <div>
            <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Model
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full md:w-64 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Support-Coordinator">Support-Coordinator</option>
              <option value="Technical-Specialist">Technical-Specialist</option>
            </select>
          </div>
          
          {/* Target URL Configuration */}
          <div>
            <label htmlFor="target-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kong Gateway Proxy URL
            </label>
            <input
              id="target-url"
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://kong-gateway-url.com/chat"
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 overflow-y-auto mb-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Send a message to begin chatting with the AI
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-700">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
}
