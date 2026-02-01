import { useState, useEffect } from 'react';
import { DeckList } from './pages/DeckList';
import { DeckEditor } from './pages/DeckEditor';
import { Presentation } from './pages/Presentation';
import './styles/global.css';

type Route =
  | { type: 'list' }
  | { type: 'editor'; deckId: string }
  | { type: 'present'; deckId: string; startSlideId?: string };

function parseRoute(): Route {
  const hash = window.location.hash;
  
  // Match /deck/:id/present or /deck/:id/present/:slideId
  const presentMatch = hash.match(/^#\/deck\/([^/]+)\/present(?:\/(.+))?$/);
  if (presentMatch) {
    return { 
      type: 'present', 
      deckId: presentMatch[1], 
      startSlideId: presentMatch[2] 
    };
  }
  
  // Match /deck/:id
  const editorMatch = hash.match(/^#\/deck\/([^/]+)$/);
  if (editorMatch) {
    return { type: 'editor', deckId: editorMatch[1] };
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

  if (route.type === 'present') {
    return (
      <Presentation
        deckId={route.deckId}
        startSlideId={route.startSlideId}
        onExit={() => navigateTo({ type: 'editor', deckId: route.deckId })}
      />
    );
  }

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
