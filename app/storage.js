// Tiny localStorage persistence layer. v1's store is in-memory, so this is how
// "liked" tracks and the last playback position survive a reload. Kept as plain
// functions with defensive JSON handling — a corrupt or absent key just yields
// defaults rather than throwing during boot.
const KEY = 'puzzle-sounds/v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    // No key at all → nothing has ever been persisted. `playlists: null` is the
    // first-run signal app.js uses to seed the starter playlists.
    if (!raw) return { likedIds: [], session: null, playlists: null };
    const parsed = JSON.parse(raw);
    return {
      likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds : [],
      session: parsed.session || null,
      // A saved array (even an empty []) means the user has playlists state —
      // respect it, including "deleted them all". Only a missing/corrupt field
      // collapses to null, which triggers first-run seeding in app.js.
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : null,
    };
  } catch {
    return { likedIds: [], session: null, playlists: null };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — non-fatal for a demo */
  }
}
