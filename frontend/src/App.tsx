import { useState, useEffect } from 'react';
import { Workspace } from './pages/Workspace';
import { AuthModal } from './components/AuthModal';
import { authStorage, api } from './services/api';
import type { UserProfile } from './types';

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => authStorage.getUser());
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(() => authStorage.isOffline());

  useEffect(() => {
    const token = authStorage.getToken();
    if (token) {
      // If it's an offline token, skip the /me call (it would fail for offline tokens
      // if the server is unreachable). Trust the cached user data.
      if (token.startsWith('offline_')) {
        setIsOffline(true);
        setIsCheckingAuth(false);
        return;
      }

      api.getMe()
        .then((profile) => {
          setUser(profile);
          authStorage.setUser(profile);
          setIsOffline(false);
          authStorage.setOffline(false);
        })
        .catch(() => {
          // Token invalid or expired — but if we have cached user data
          // and the server is simply unreachable, stay logged in offline
          const cachedUser = authStorage.getUser();
          if (cachedUser) {
            setUser(cachedUser);
            setIsOffline(true);
            authStorage.setOffline(true);
          } else {
            authStorage.clear();
            setUser(null);
          }
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleAuthSuccess = (authenticatedUser: UserProfile, offline?: boolean) => {
    setUser(authenticatedUser);
    setIsOffline(offline ?? false);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setIsOffline(false);
  };

  const handleUserUpdated = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    authStorage.setUser(updatedUser);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium tracking-wide">
            Connecting to Notepad AI...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthModal
        onSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <Workspace
      user={user}
      onLogout={handleLogout}
      onUserUpdated={handleUserUpdated}
      isOffline={isOffline}
    />
  );
}

export default App;
