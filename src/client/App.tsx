import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../shared/board';
import type { Profile } from '../shared/protocol';
import type { BoardTheme } from '../shared/theme';
import { BoardEditor, BoardImport, BoardList } from './components/BoardEditor';
import { Home, type OfflineConfig } from './components/Home';
import { OfflineGame } from './components/OfflineGame';
import { OnlineRoom } from './components/OnlineRoom';
import { Toasts } from './components/Toasts';
import { loadPref, loadProfile, saveProfile } from './profile';

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

  const playBoard = (theme: BoardTheme) => {
    let settings = DEFAULT_SETTINGS;
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(loadPref('settings', '{}')) };
    } catch {
      /* defaults */
    }
    setOffline({ bots: 3, level: 'normal', settings: { ...settings, maxPlayers: 8 }, theme });
    go('/offline');
  };

  const roomMatch = route.match(/^\/room\/([A-Z0-9]+)/i);
  const editMatch = route.match(/^\/editor\/([\w-]+)/);
  const importMatch = route.match(/^\/board\/([\w-]+)/);
  let screen;
  if (route === '/editor') {
    screen = <BoardList onBack={() => go('/')} onEdit={(id) => go(`/editor/${id}`)} onPlay={playBoard} />;
  } else if (editMatch) {
    screen = <BoardEditor key={editMatch[1]} id={editMatch[1]} onBack={() => go('/editor')} onPlay={playBoard} />;
  } else if (importMatch) {
    screen = <BoardImport code={importMatch[1]} onDone={() => go('/')} onPlay={playBoard} />;
  } else if (roomMatch && profile.name) {
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
        onBoards={() => go('/editor')}
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
