import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../shared/protocol';
import { Home, type OfflineConfig } from './components/Home';
import { OfflineGame } from './components/OfflineGame';
import { OnlineRoom } from './components/OnlineRoom';
import { Toasts } from './components/Toasts';
import { loadProfile, saveProfile } from './profile';

function useHashRoute(): [string, (r: string) => void] {
  const get = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: string) => {
    window.location.hash = r;
  }, []);
  return [route, go];
}

export function App() {
  const [route, go] = useHashRoute();
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const [offline, setOffline] = useState<OfflineConfig | null>(null);

  const setProfile = (p: Profile) => {
    setProfileState(p);
    saveProfile(p);
  };

  const roomMatch = route.match(/^\/room\/([A-Z0-9]+)/i);
  let screen;
  if (roomMatch && profile.name) {
    screen = <OnlineRoom key={roomMatch[1]} roomId={roomMatch[1].toUpperCase()} profile={profile} onExit={() => go('/')} />;
  } else if (route === '/offline' && offline) {
    screen = <OfflineGame config={offline} profile={profile} onExit={() => go('/')} />;
  } else {
    screen = (
      <Home
        profile={profile}
        setProfile={setProfile}
        pendingRoom={roomMatch?.[1]?.toUpperCase()}
        onJoin={(id) => go(`/room/${id}`)}
        onOffline={(cfg) => {
          setOffline(cfg);
          go('/offline');
        }}
      />
    );
  }

  return (
    <>
      <div className="bg-orbs" aria-hidden />
      {screen}
      <Toasts />
    </>
  );
}
