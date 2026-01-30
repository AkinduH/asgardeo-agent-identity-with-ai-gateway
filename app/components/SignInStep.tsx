'use client'

import SignedInPanel from './SignedInPanel';

interface Props {
  config: { orgName: string; clientId: string };
  isConfigured: boolean;
  isSaving: boolean;
  error: string | null;
  isAuthenticated: boolean;
  handleSignIn: () => void;
  handleReset: () => void;
  userInfo: any;
  handleSignOut: () => void;
}

export default function SignInStep({
  config,
  isConfigured,
  isSaving,
  error,
  isAuthenticated,
  handleSignIn,
  handleReset,
  userInfo,
  handleSignOut,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
      {!isAuthenticated ? (
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Step 3: Sign In</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Your Asgardeo configuration is complete! You can now sign in.
            </p>
          </div>

          {isConfigured && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium mb-2 text-sm">Configuration Summary:</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>Organization:</strong> {config.orgName}</p>
                <p><strong>Base URL:</strong> https://api.asgardeo.io/t/{config.orgName}</p>
                <p><strong>Client ID:</strong> {config.clientId.substring(0, 10)}...</p>
                <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                  <strong>Note:</strong> Before signing in, create an agent at{' '}
                  <a
                    href={`https://console.asgardeo.io/t/${config.orgName}/app/agents`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline"
                  >
                    Agents
                  </a>{' '}
                  to be used for sign in.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleSignIn}
              disabled={isSaving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Redirecting...' : 'Sign in with Asgardeo'}
            </button>
            <button
              onClick={handleReset}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Reset configuration
            </button>
          </div>
        </div>
      ) : (
        <SignedInPanel
          userInfo={userInfo}
          handleSignOut={handleSignOut}
          handleReset={handleReset}
        />
      )}
    </div>
  );
}
