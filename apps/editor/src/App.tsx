import { useState, useEffect } from 'react';
import { DeckList } from './pages/DeckList';
import { DeckEditor } from './pages/DeckEditor';
import './styles/global.css';

type Route =
  | { type: 'list' }
  | { type: 'editor'; deckId: string };

function parseRoute(): Route {
  const hash = window.location.hash;
  const match = hash.match(/^#\/deck\/(.+)$/);
  if (match) {
    return { type: 'editor', deckId: match[1] };
  }
  return { type: 'list' };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseRoute());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (newRoute: Route) => {
    if (newRoute.type === 'list') {
      window.location.hash = '/';
    } else {
      window.location.hash = `/deck/${newRoute.deckId}`;
    }
  };

  if (route.type === 'editor') {
    return (
      <DeckEditor
        deckId={route.deckId}
        onBack={() => navigateTo({ type: 'list' })}
      />
    );
  }

  return <DeckList onOpenDeck={(id) => navigateTo({ type: 'editor', deckId: id })} />;
}
