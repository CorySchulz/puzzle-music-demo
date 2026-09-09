// Real playback. The store stays the single source of truth — every surface
// still reads and writes the `player` record (id: 'session') and nothing else
// knows an <audio> element exists. This module is the side-effect layer that
// makes the DOM follow that record: one shared HTMLAudioElement, subscribed to
// the record, mirroring src / play / pause / volume out and progress / end back.
//
// It replaces the two 1-second setInterval simulators that used to live in
// MiniPlayer and NowPlaying. Those had to be duplicated because whichever
// surface was mounted owned the clock; a single element owned by the app has no
// such problem — it survives every route swap.

// How far the store's progressSec may drift from the element's currentTime
// before we read it as a deliberate seek rather than our own timeupdate write.
// One second of rounding plus a little slack for a frame-batched notification.
const SEEK_EPSILON_SEC = 1.5;

/**
 * Wire the shared audio element to the player record. Call once, after the app
 * is constructed (alongside enableMorph) — the record itself is created later in
 * beforeMount, and the subscription below picks it up the moment it appears.
 */
export function enableAudio(app) {
  // beforeMount/data() also run under node during a prerender pass; there is no
  // media element there and nothing to drive, so bail before touching the DOM.
  if (typeof document === 'undefined') return;

  const store = app.store;

  // In the document (not a detached `new Audio()`) so it is inspectable in
  // devtools and the browser can attribute media playback to the page. It lives
  // outside #app, so Puzzle's patcher never sees it.
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.hidden = true;
  document.body.appendChild(audio);

  // The url currently assigned to the element. src is re-assigned ONLY when this
  // changes — reading audio.src back would compare a resolved absolute URL, and
  // any spurious re-assignment restarts playback from zero.
  let loadedUrl = '';
  // Whole second last pushed into the store from timeupdate. Guards the store
  // against the 4-ish notifications a second the browser fires, and is reset
  // whenever we move the playhead ourselves so the next tick always writes.
  let writtenSec = -1;
  // Position to restore once metadata arrives: a persisted session's progressSec
  // (app.js restores the cued track but deliberately never resumes playback), or
  // a seek issued before the new file was ready.
  let pendingSeekSec = 0;

  const player = () => store.findOne('player', 'session');

  // ---- store → element ------------------------------------------------------

  // A plain function subscriber: the store tracks the reads made inside
  // withTracking and calls it again whenever one of those records changes, the
  // same mechanism a view's data() rides. Re-runs are frame-batched, so a burst
  // of updates in one tick reconciles the element exactly once.
  const sync = () => {
    store.withTracking(sync, () => {
      const p = player();
      if (!p) return; // pre-beforeMount: the record notifies us when it is created

      const track = p.currentTrackId ? store.findOne('track', p.currentTrackId) : null;
      const url = track ? track.audioUrl : '';

      if (url !== loadedUrl) {
        loadedUrl = url;
        writtenSec = -1;
        // Whatever progressSec says at a track change is where the new file
        // should start — 0 for play()/advance(), the persisted offset for a
        // session restored at boot. Applied on loadedmetadata, since currentTime
        // is not settable until the browser knows the duration.
        pendingSeekSec = p.progressSec;
        if (url) {
          audio.src = url;
        } else {
          audio.removeAttribute('src');
          audio.load(); // drop the decoded buffer; a bare removeAttribute keeps playing
        }
      } else if (Math.abs(p.progressSec - audio.currentTime) > SEEK_EPSILON_SEC) {
        // Same file, but the store moved the playhead further than our own
        // per-second writes ever could: a scrub on either progress bar. (The
        // reverse direction can't loop — writing currentTime produces a
        // timeupdate whose whole second already matches progressSec.)
        seekTo(p.progressSec);
      }

      audio.volume = p.volume;

      if (p.isPlaying && audio.paused) {
        // Rejects when there was no user gesture (autoplay policy) or when the
        // file will not load. Never let that surface as an unhandled rejection,
        // and put isPlaying back to false so the transport shows the truth — a
        // record left claiming "playing" over a silent element makes the user's
        // next click read as pause and do nothing visible.
        audio.play().catch((err) => {
          console.warn('[music] play blocked:', err);
          const now = player();
          if (now && now.isPlaying && audio.paused) now.update({ isPlaying: false });
        });
      } else if (!p.isPlaying && !audio.paused) {
        audio.pause();
      }
    });
  };

  // Move the playhead without letting the next timeupdate look like a no-op:
  // clearing writtenSec forces the following tick to write, so the UI catches up
  // even when the browser lands a fraction inside the same second.
  const seekTo = (sec) => {
    if (!Number.isFinite(audio.duration)) {
      pendingSeekSec = sec; // metadata not in yet — loadedmetadata applies it
      return;
    }
    writtenSec = -1;
    audio.currentTime = Math.min(sec, audio.duration);
  };

  // ---- element → store ------------------------------------------------------

  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeekSec > 0) audio.currentTime = Math.min(pendingSeekSec, audio.duration);
    pendingSeekSec = 0;
  });

  audio.addEventListener('timeupdate', () => {
    const sec = Math.floor(audio.currentTime);
    if (sec === writtenSec) return; // fires ~4x/sec; only whole seconds are news
    writtenSec = sec;
    const p = player();
    if (p && p.progressSec !== sec) p.update({ progressSec: sec });
  });

  audio.addEventListener('ended', () => {
    writtenSec = -1;
    // The repeat/shuffle rules live in the model — advance() decides whether to
    // restart, step, wrap or stop, and the sync above follows whatever it does.
    player()?.advance();
  });

  audio.addEventListener('error', () => {
    console.warn('[music] audio failed to load:', loadedUrl, audio.error);
  });

  sync();
}
