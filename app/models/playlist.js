import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

// A user-owned playlist. Local-only, exactly like Player (models/player.js): it
// declares NO adapter — playlists are created at boot (restored from
// localStorage or seeded) and mutated in the store, never fetched from a server.
// Track membership lives here as an ordered `trackIds` array (the join to real
// track records happens in the view's data(), keeping the store the source of
// truth — same pattern the Album model documents for its tracks).
export default class Playlist extends PuzzleModel {
  static schema = {
    id:       Puzzle.string().primary(),
    name:     Puzzle.string().required(),
    trackIds: Puzzle.array().default(() => []),
    // A from/to gradient pair, same shape as album/artist accents — drives the
    // square tile on the playlist page and the sidebar swatch.
    accent:   Puzzle.object().default(() => ({ from: '#7c5cff', to: '#4338ca' })),
    // Sidebar sort key (lower sorts first).
    order:    Puzzle.number().default(0),
  };

  // Inline-style gradient for the accent tile — mirrors Album#artwork.
  get artwork() {
    const a = this.accent || {};
    return `linear-gradient(135deg, ${a.from || '#7c5cff'}, ${a.to || '#4338ca'})`;
  }

  // Rename, trimmed. Empty/whitespace-only input is a no-op (keeps the old name).
  rename(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return this;
    return this.update({ name: trimmed });
  }

  // Append a track id, de-duped — a no-op if it's already in the playlist.
  addTrack(id) {
    if (!id || this.trackIds.includes(id)) return this;
    return this.update({ trackIds: [...this.trackIds, id] });
  }

  // Drop a track id (no-op if absent). update() notifies subscribers, so any
  // view listing this playlist re-runs data() and the row disappears.
  removeTrack(id) {
    if (!this.trackIds.includes(id)) return this;
    return this.update({ trackIds: this.trackIds.filter((t) => t !== id) });
  }
}
