import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

// The player is a SINGLE store record (id: 'session') that holds all playback
// state. Because it lives in the store, every surface that reads it —
// the persistent MiniPlayer in the layout and the full-screen NowPlaying view —
// auto-subscribes and re-renders together. It declares no adapter: it is created
// locally at boot, never fetched.
export default class Player extends PuzzleModel {
  static schema = {
    id:             Puzzle.string().primary(),
    currentTrackId: Puzzle.string().default(''),
    isPlaying:      Puzzle.boolean().default(false),
    progressSec:    Puzzle.number().default(0),
    volume:         Puzzle.number().min(0).max(1).default(0.8),
    // Remembers the pre-mute level so toggleMute() can restore it.
    lastVolume:     Puzzle.number().min(0).max(1).default(0.8),
    // Shuffle picks the next track at random; repeat is 'off' | 'all' | 'one'.
    shuffle:        Puzzle.boolean().default(false),
    repeat:         Puzzle.string().default('off'),
    // The play queue as an ordered list of track ids (a Puzzle.array()).
    queue:          Puzzle.array().default(() => []),
    // Recently-played album ids, newest first (move-to-front, capped) — feeds the
    // Home "Recently played" shelf. Persisted in the session snapshot (app.js).
    recentAlbumIds: Puzzle.array().default(() => []),
  };

  // Start a track. `queue` is the ordered id list it belongs to (an album's
  // tracks, search results, …) so next/prev know where to go.
  play(trackId, queue) {
    return this.update({
      currentTrackId: trackId,
      queue: queue && queue.length ? queue : this.queue,
      isPlaying: true,
      progressSec: 0,
      // Record the started track's album at the front of the recents (models can
      // reach the store via `this._store`). Dedupe move-to-front, cap at 6, so the
      // shelf shows the last six distinct albums you played, newest first.
      recentAlbumIds: this._pushRecentAlbum(trackId),
    });
  }

  // Build the next recentAlbumIds array for a just-started track: look up its
  // album, drop any existing occurrence (so it MOVES rather than duplicating),
  // unshift to the front, and cap the list at 6. Returns a fresh array (never
  // mutates the schema array in place); leaves it unchanged when the album is
  // unknown so a bad id can't corrupt the shelf.
  _pushRecentAlbum(trackId) {
    const track = this._store ? this._store.findOne('track', trackId) : null;
    const albumId = track ? track.albumId : '';
    if (!albumId) return this.recentAlbumIds;
    const without = this.recentAlbumIds.filter((id) => id !== albumId);
    return [albumId, ...without].slice(0, 6);
  }

  // Play/pause. No-op until something is loaded.
  toggle() {
    if (!this.currentTrackId) return this;
    return this.update({ isPlaying: !this.isPlaying });
  }

  seekTo(sec) {
    return this.update({ progressSec: Math.max(0, Math.round(sec)) });
  }

  // Shuffle toggle. When on, next/advance pick a random queued track instead of
  // stepping sequentially.
  toggleShuffle() {
    return this.update({ shuffle: !this.shuffle });
  }

  // Cycle the repeat mode: off → all → one → off.
  cycleRepeat() {
    const nextMode = { off: 'all', all: 'one', one: 'off' };
    return this.update({ repeat: nextMode[this.repeat] || 'all' });
  }

  // Set the output volume (0..1, clamped). A non-zero level is also stashed as
  // lastVolume so toggleMute() has something to restore.
  setVolume(v) {
    const vol = Math.min(1, Math.max(0, Number(v) || 0));
    const patch = { volume: vol };
    if (vol > 0) patch.lastVolume = vol;
    return this.update(patch);
  }

  // Mute/unmute. Muting saves the current level; unmuting restores it (falling
  // back to a sensible default if we were somehow muted with nothing saved).
  toggleMute() {
    if (this.volume > 0) {
      return this.update({ lastVolume: this.volume, volume: 0 });
    }
    return this.update({ volume: this.lastVolume || 0.8 });
  }

  // Shared mover for advance()/next(): step to the next track per the order
  // rules (random when shuffle is on, sequential otherwise), wrapping to the
  // first entry when repeat is 'all' and stopping when 'off'. Returns the newly
  // playing id, or '' when playback stops.
  _moveNext() {
    const nextId = this._pickNextId();
    if (nextId) {
      this.update({ currentTrackId: nextId, progressSec: 0, isPlaying: true });
      return nextId;
    }
    // Sequential queue exhausted (shuffle never lands here): wrap or stop.
    if (this.repeat === 'all' && this.queue.length) {
      const firstId = this.queue[0];
      this.update({ currentTrackId: firstId, progressSec: 0, isPlaying: true });
      return firstId;
    }
    this.update({ isPlaying: false, progressSec: 0 });
    return '';
  }

  // Pick the next candidate id per the order rules. Shuffle: a random track
  // from the queue excluding the current one (a single-track queue restarts it,
  // so this never signals exhaustion). Sequential: the following id, or '' when
  // already on the last entry (the caller decides wrap vs stop).
  _pickNextId() {
    const q = this.queue;
    if (!q.length) return '';
    if (this.shuffle) {
      if (q.length === 1) return q[0];
      const others = q.filter((id) => id !== this.currentTrackId);
      return others[Math.floor(Math.random() * others.length)];
    }
    const i = q.indexOf(this.currentTrackId);
    return i > -1 && i + 1 < q.length ? q[i + 1] : '';
  }

  // AUTO-advance — fired by the 1-second tick when a track reaches its end.
  // repeat 'one' restarts the same track in place; otherwise move on per the
  // order rules (wrap on 'all', stop on 'off').
  advance() {
    if (this.repeat === 'one') {
      this.update({ progressSec: 0, isPlaying: true });
      return this.currentTrackId;
    }
    return this._moveNext();
  }

  // MANUAL skip (the Next button). Unlike advance(), repeat 'one' does NOT pin a
  // manual skip (Spotify behavior) — this always moves to another track, still
  // wrapping on 'all' and stopping on 'off'.
  next() {
    return this._moveNext();
  }

  prev() {
    const i = this.queue.indexOf(this.currentTrackId);
    const prevId = i > 0 ? this.queue[i - 1] : this.currentTrackId;
    this.update({ currentTrackId: prevId, progressSec: 0, isPlaying: true });
    return prevId;
  }

  // Cue a track to play immediately after the current one. Any existing
  // occurrence is pulled out first so the track MOVES rather than duplicating.
  // With nothing cued yet, there is no "after current" to slot into, so we just
  // start it (same fallback addToQueue uses). `queue` is a schema array — we
  // always hand update() a fresh array, never mutate in place.
  playNext(trackId) {
    if (!trackId) return this;
    if (!this.currentTrackId) return this.play(trackId, [trackId]);
    // Inserting a track "after itself" is a no-op — it's already current.
    if (trackId === this.currentTrackId) return this;
    const without = this.queue.filter((id) => id !== trackId);
    const i = without.indexOf(this.currentTrackId);
    const next = without.slice();
    // Splice in right after the current track (or at the front if the current
    // track somehow isn't in the queue — i === -1 → insert at index 0).
    next.splice(i + 1, 0, trackId);
    return this.update({ queue: next });
  }

  // Append a track to the end of the queue. Already-queued → no-op (no dupes).
  // Same nothing-cued fallback as playNext: just start playing it.
  addToQueue(trackId) {
    if (!trackId) return this;
    if (!this.currentTrackId) return this.play(trackId, [trackId]);
    if (this.queue.includes(trackId)) return this;
    return this.update({ queue: [...this.queue, trackId] });
  }

  // Drop a track from the queue (no-op if absent). If it happens to be the
  // current track we leave currentTrackId/isPlaying untouched — it keeps
  // playing, it just no longer appears in the queue list.
  removeFromQueue(trackId) {
    if (!this.queue.includes(trackId)) return this;
    return this.update({ queue: this.queue.filter((id) => id !== trackId) });
  }

  // Empty the queue down to just the current track (so "Up next" clears but the
  // song keeps playing); with nothing cued the queue becomes empty.
  clearQueue() {
    return this.update({ queue: this.currentTrackId ? [this.currentTrackId] : [] });
  }
}
