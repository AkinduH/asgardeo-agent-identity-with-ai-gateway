'use client';

import { useState } from 'react';
import { AppConfig } from './ConfigurationModal';

interface AgentSimulatorProps {
  config: AppConfig;
  onOpenConfig: () => void;
}

type SimulationCase = 'correct-agent' | 'wrong-agent' | 'no-auth';

interface SimulationResult {
  caseType: SimulationCase;
  agentType: string;
  authUsed: string;
  tokenReceived: string | null;
  response: any;
  statusCode: number;
  timestamp: Date;
}

export default function AgentSimulator({ config, onOpenConfig }: AgentSimulatorProps) {
  const [selectedCase, setSelectedCase] = useState<SimulationCase>('correct-agent');
  const [selectedAgent, setSelectedAgent] = useState<string>('Support-Coordinator');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const isConfigValid = () => {
    return config.orgName && config.clientId && config.targetUrl &&
           config.coordinatorAgent.agentId && config.coordinatorAgent.agentSecret &&
           config.expertAgent.agentId && config.expertAgent.agentSecret;
  };

  const getAgentCredentials = (agentType: string) => {
    if (agentType === 'Support-Coordinator') {
      return {
        agentId: config.coordinatorAgent.agentId,
        agentSecret: config.coordinatorAgent.agentSecret
      };
    } else {
      return {
        agentId: config.expertAgent.agentId,
        agentSecret: config.expertAgent.agentSecret
      };
    }
  };

  const getWrongAgentCredentials = () => {
    // Support-Coordinator trying to act as Technical-Specialist
    // Uses Coordinator's credentials but sends as Technical-Specialist
    return {
      credentials: {
        agentId: config.coordinatorAgent.agentId,
        agentSecret: config.coordinatorAgent.agentSecret
      },
      claimedAgentType: 'Technical-Specialist'
    };
  };

  const authenticateAgent = async (agentId: string, agentSecret: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/agent-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: config.orgName,
          clientId: config.clientId,
          agentId: agentId,
          agentSecret: agentSecret
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to authenticate');
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  };

  const sendChatRequest = async (token: string | null, agentType: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-agent-type': agentType,
      'x-target-url': config.targetUrl
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Hello, I am ${agentType}. This is a test message.` }]
      })
    });

    const data = await response.json();
    return { data, statusCode: response.status };
  };

  const runSimulation = async () => {
    if (!isConfigValid()) {
      alert('Please configure all settings first');
      onOpenConfig();
      return;
    }

    setIsLoading(true);
    let result: SimulationResult;

    try {
      switch (selectedCase) {
        case 'correct-agent': {
          // Case 1: Agent calling as the correct agent
          const credentials = getAgentCredentials(selectedAgent);
          const token = await authenticateAgent(credentials.agentId, credentials.agentSecret);
          const { data, statusCode } = await sendChatRequest(token, selectedAgent);
          
          result = {
            caseType: 'correct-agent',
            agentType: selectedAgent,
            authUsed: `${selectedAgent} credentials`,
            tokenReceived: token,
            response: data,
            statusCode,
            timestamp: new Date()
          };
          break;
        }

        case 'wrong-agent': {
          // Case 2: Support-Coordinator trying to act as Technical-Specialist
          const { credentials, claimedAgentType } = getWrongAgentCredentials();
          const token = await authenticateAgent(credentials.agentId, credentials.agentSecret);
          const { data, statusCode } = await sendChatRequest(token, claimedAgentType);
          
          result = {
            caseType: 'wrong-agent',
            agentType: 'Technical-Specialist',
            authUsed: 'Support-Coordinator credentials',
            tokenReceived: token,
            response: data,
            statusCode,
            timestamp: new Date()
          };
          break;
        }

        case 'no-auth': {
          // Case 3: Agent calling without authentication
          const { data, statusCode } = await sendChatRequest(null, selectedAgent);
          
          result = {
            caseType: 'no-auth',
            agentType: selectedAgent,
            authUsed: 'No authentication',
            tokenReceived: null,
            response: data,
            statusCode,
            timestamp: new Date()
          };
          break;
        }

        default:
          throw new Error('Invalid simulation case');
      }

      setResults(prev => [result, ...prev]);
      setExpandedResult(0);
    } catch (error) {
      const errorResult: SimulationResult = {
        caseType: selectedCase,
        agentType: selectedAgent,
        authUsed: selectedCase === 'no-auth' ? 'No authentication' : `${selectedAgent} credentials`,
        tokenReceived: null,
        response: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        timestamp: new Date()
      };
      setResults(prev => [errorResult, ...prev]);
      setExpandedResult(0);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setExpandedResult(null);
  };

  const getCaseDescription = (caseType: SimulationCase) => {
    switch (caseType) {
      case 'correct-agent':
        return 'Correct Agent Authentication';
      case 'wrong-agent':
        return 'Wrong Agent (Impersonation Attempt)';
      case 'no-auth':
        return 'No Authentication';
    }
  };

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {statusCode} Success
        </span>
      );
    } else if (statusCode >= 400 && statusCode < 500) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          {statusCode} Client Error
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {statusCode} Error
        </span>
      );
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
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Agent Simulator</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Test AI Gateway with different agent scenarios
              </p>
            </div>
          </div>
          <button
            onClick={onOpenConfig}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Configuration
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Config Warning */}
        {!isConfigValid() && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-600 dark:text-yellow-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              Please configure all settings before running simulations.
            </span>
            <button
              onClick={onOpenConfig}
              className="ml-auto px-3 py-1 text-sm font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/60 rounded-lg transition-colors"
            >
              Open Configuration
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Simulation Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Simulation
            </h2>

            {/* Case Selection */}
            <div className="space-y-4 mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Simulation Case
              </label>
              
              {/* Case 1: Correct Agent */}
              <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedCase === 'correct-agent'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <input
                  type="radio"
                  name="case"
                  value="correct-agent"
                  checked={selectedCase === 'correct-agent'}
                  onChange={() => setSelectedCase('correct-agent')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">Case 1:Agent on Correct Path</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      Expected: Success
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Agent authenticates with its own credentials and calls the API as itself
                  </p>
                </div>
              </label>

              {/* Case 2: Wrong Agent */}
              <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedCase === 'wrong-agent'
                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <input
                  type="radio"
                  name="case"
                  value="wrong-agent"
                  checked={selectedCase === 'wrong-agent'}
                  onChange={() => setSelectedCase('wrong-agent')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">Case 2: Agent on Wrong Path (Impersonation)</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                      Expected: Denied
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Support-Coordinator authenticates with its credentials but tries to act as Technical-Specialist
                  </p>
                </div>
              </label>

              {/* Case 3: No Auth */}
              <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedCase === 'no-auth'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <input
                  type="radio"
                  name="case"
                  value="no-auth"
                  checked={selectedCase === 'no-auth'}
                  onChange={() => setSelectedCase('no-auth')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">Case 3: No Authentication</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                      Expected: Unauthorized
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Agent calls the API without any authorization header
                  </p>
                </div>
              </label>
            </div>

            {/* Agent Selection (for Case 1 and Case 3) */}
            {(selectedCase === 'correct-agent' || selectedCase === 'no-auth') && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Agent to Simulate
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="Support-Coordinator">Support-Coordinator</option>
                  <option value="Technical-Specialist">Technical-Specialist</option>
                </select>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={runSimulation}
              disabled={isLoading || !isConfigValid()}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg shadow-lg hover:shadow-xl disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Running Simulation...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Run Simulation
                </>
              )}
            </button>
          </div>

          {/* Results Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                Simulation Results
              </h2>
              {results.length > 0 && (
                <button
                  onClick={clearResults}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                </div>
                <h3 className="text-gray-700 dark:text-gray-300 font-medium mb-1">No Results Yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Run a simulation to see the results here
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Result Header */}
                    <button
                      onClick={() => setExpandedResult(expandedResult === index ? null : index)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          result.statusCode >= 200 && result.statusCode < 300
                            ? 'bg-green-500'
                            : result.statusCode >= 400 && result.statusCode < 500
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`} />
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {getCaseDescription(result.caseType)}
                        </span>
                        {getStatusBadge(result.statusCode)}
                      </div>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`text-gray-400 transition-transform ${expandedResult === index ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>

                    {/* Result Details */}
                    {expandedResult === index && (
                      <div className="px-4 py-3 space-y-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Agent Type Requested:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{result.agentType}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Authentication:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{result.authUsed}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">
                            {result.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        
                        {result.tokenReceived && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-gray-500 dark:text-gray-400">Token Received:</span>
                              <a
                                href={`https://jwt.io/#id_token=${result.tokenReceived}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded transition-colors"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                                Decode Token
                              </a>
                            </div>
                            <code className="block p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs break-all max-h-20 overflow-y-auto">
                              {result.tokenReceived}
                            </code>
                          </div>
                        )}
                        
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block mb-1">Response:</span>
                          <pre className="p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                            {JSON.stringify(result.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
