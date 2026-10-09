import { useState, useEffect } from 'react';
import { Workspace } from './pages/Workspace';
import { AuthModal } from './components/AuthModal';
import { authStorage, api } from './services/api';
import type { UserProfile } from './types';

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => authStorage.getUser());
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    const token = authStorage.getToken();
    if (token) {
      api.getMe()
        .then((profile) => {
          setUser(profile);
          authStorage.setUser(profile);
        })
        .catch(() => {
          // Token invalid or expired
          authStorage.clear();
          setUser(null);
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsGuest(false);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setIsGuest(false);
  };

  const handleUserUpdated = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    authStorage.setUser(updatedUser);
  };

  const handleContinueAsGuest = () => {
    setIsGuest(true);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium tracking-wide">
            Connecting to Conext workspace...
          </span>
        </div>
      </div>
    );
  }

  // Show AuthModal if user is neither authenticated nor in guest mode
  if (!user && !isGuest) {
    return (
      <AuthModal
        onSuccess={handleAuthSuccess}
        onContinueAsGuest={handleContinueAsGuest}
      />
    );
  }

  return (
    <Workspace
      user={user}
      onLogout={handleLogout}
      onUserUpdated={handleUserUpdated}
    />
  );
}

export default App;
