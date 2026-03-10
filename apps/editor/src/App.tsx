import { useState, useEffect } from 'react';
import { DeckList } from './pages/DeckList';
import { DeckEditor } from './pages/DeckEditor';
import { Presentation } from './pages/Presentation';
import { PublicPresentation } from './pages/PublicPresentation';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './auth/LoginPage';
import { SignupPage } from './auth/SignupPage';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';
import { AppBar } from './components/AppBar';
import './styles/global.css';

type Route =
  | { type: 'list' }
  | { type: 'editor'; deckId: string }
  | { type: 'present'; deckId: string; startSlideId?: string }
  | { type: 'public-present'; deckId: string }
  | { type: 'login' }
  | { type: 'signup' }
  | { type: 'forgot-password' }
  | { type: 'callback' }; // path-based /callback, handled by AuthProvider

function parseRoute(): Route {
  const hash = window.location.hash;

  // Path-based routes (not hash) for auth and public pages
  const pathname = window.location.pathname;
  if (pathname === '/callback') return { type: 'callback' };
  if (pathname === '/login') return { type: 'login' };
  if (pathname === '/signup') return { type: 'signup' };
  if (pathname === '/forgot-password') return { type: 'forgot-password' };

  // Public presentation: /present/:deckId
  const publicPresentMatch = pathname.match(/^\/present\/([^/]+)$/);
  if (publicPresentMatch) {
    return { type: 'public-present', deckId: publicPresentMatch[1] };
  }

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
    } else if (newRoute.type === 'editor') {
      window.location.hash = `/deck/${newRoute.deckId}`;
    }
  };

  return (
    <AuthProvider>
      <AppRoutes route={route} navigateTo={navigateTo} />
    </AuthProvider>
  );
}

function AppRoutes({
  route,
  navigateTo,
}: {
  route: Route;
  navigateTo: (r: Route) => void;
}) {
  const { user, isLoading } = useAuth();

  // Public/auth pages — no authentication required
  switch (route.type) {
    case 'login':
      return <LoginPage />;
    case 'signup':
      return <SignupPage />;
    case 'forgot-password':
      return <ForgotPasswordPage />;
    case 'callback':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p>Completing login...</p>
        </div>
      );
    case 'public-present':
      return <PublicPresentation deckId={route.deckId} />;
  }

  // Wait for auth state to resolve before deciding
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!user) {
    window.location.href = '/login';
    return null;
  }

  // Presentation mode — fullscreen, no app bar
  if (route.type === 'present') {
    return (
      <Presentation
        deckId={route.deckId}
        startSlideId={route.startSlideId}
        onExit={() => navigateTo({ type: 'editor', deckId: route.deckId })}
      />
    );
  }

  // Editor — fullscreen, no app bar (has its own CanvasHeader)
  if (route.type === 'editor') {
    return (
      <DeckEditor
        deckId={route.deckId}
        onBack={() => navigateTo({ type: 'list' })}
      />
    );
  }

  // Other authenticated routes with app bar
  return (
    <>
      <AppBar />
      <DeckList onOpenDeck={(id) => navigateTo({ type: 'editor', deckId: id })} />
    </>
  );
}
