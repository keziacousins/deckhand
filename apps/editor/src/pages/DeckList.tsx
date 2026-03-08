import { useState, useEffect, useRef } from 'react';
import {
  listDecks,
  createDeck,
  deleteDeck,
  duplicateDeck,
  apiFetch,
  type DeckMetadata,
} from '../api/decks';
import './DeckList.css';

/** Fetches a cover image via authenticated apiFetch and renders as blob URL. */
function CoverImage({ src }: { src: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    apiFetch(src).then((res) => {
      if (!res.ok) return;
      return res.blob();
    }).then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      revoke = url;
      setBlobUrl(url);
    }).catch(() => {});

    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);

  if (!blobUrl) return null;
  return <img src={blobUrl} alt="" className="deck-card-cover" />;
}

interface DeckListProps {
  onOpenDeck: (id: string) => void;
}

export function DeckList({ onOpenDeck }: DeckListProps) {
  const [decks, setDecks] = useState<DeckMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listDecks();
      setDecks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decks');
    } finally {
      setLoading(false);
    }
  };

  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchDecks();
  }, []);

  const handleCreateDeck = async () => {
    try {
      const newDeck = await createDeck({ title: 'Untitled Deck' });
      onOpenDeck(newDeck.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deck');
    }
  };

  const handleDeleteDeck = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this deck?')) return;

    try {
      await deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deck');
    }
  };

  const handleDuplicateDeck = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newDeck = await duplicateDeck(id);
      setDecks((prev) => [newDeck, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate deck');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="deck-list-page">
      <header className="deck-list-header">
        <h1>Decks</h1>
        <button className="create-deck-button" onClick={handleCreateDeck}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          New Deck
        </button>
      </header>

      {error && (
        <div className="deck-list-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="deck-list-loading">Loading...</div>
      ) : decks.length === 0 ? (
        <div className="deck-list-empty">
          <p>No decks yet</p>
          <p>Create your first deck to get started</p>
          <button className="create-deck-button" onClick={handleCreateDeck}>
            Create Deck
          </button>
        </div>
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="deck-card"
              onClick={() => onOpenDeck(deck.id)}
            >
              <div className="deck-card-preview">
                {deck.coverUrl && (
                  <CoverImage src={deck.coverUrl} />
                )}
                <span className="deck-card-slide-count">
                  {deck.slideCount} slide{deck.slideCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="deck-card-info">
                <h3 className="deck-card-title">
                  {deck.title}
                  {deck.role && deck.role !== 'owner' && (
                    <span className="deck-card-role-badge">{deck.role}</span>
                  )}
                </h3>
                {deck.description && (
                  <p className="deck-card-description">{deck.description}</p>
                )}
                <p className="deck-card-date">Updated {formatDate(deck.updatedAt)}</p>
              </div>
              <div className="deck-card-actions">
                <button
                  className="deck-card-action"
                  onClick={(e) => handleDuplicateDeck(deck.id, e)}
                  title="Duplicate"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="5"
                      y="5"
                      width="9"
                      height="9"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
                {deck.role === 'owner' && (
                  <button
                    className="deck-card-action deck-card-action-danger"
                    onClick={(e) => handleDeleteDeck(deck.id, e)}
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
