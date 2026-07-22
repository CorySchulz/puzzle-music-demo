import { PuzzleApp } from '@magic-spells/puzzle';
import { enableMorph } from '@magic-spells/puzzle/morph';
import routes from './routes.js';
import models from './models/index.js';
import { loadState, saveState } from './storage.js';

// The v1 config surface is intentionally small: target, routes, models,
// formatters, apiURL — see constellation/doc/DOC-SPEC.md §2.
const app = new PuzzleApp({
  target: '#app',
  routes,
  models,
  // Route rides in location.hash (`…/index.html#/album/x`), so the built example
  // hosts on any static host — GitHub Pages / S3 / file:// — with no server
  // rewrite rules (SPEC §15, D34). App code stays path-shaped; only URLs differ.
  routerMode: 'hash',
  // No apiURL prefix: each model's adapter endpoint (e.g. '/artists.json') is
  // root-relative, so the seed files sit flat at the site root next to
  // index.html (dist/artists.json) and host anywhere with zero path wiring.
  // Point apiURL at a CDN/host later and the same endpoints follow it.
  apiURL: '',

  // Display-only formatters (logic belongs in data()). `duration` turns a track's
  // durationSec into m:ss; `compact` shortens big play counts; `plural` picks a
  // word form.
  formatters: {
    duration: (sec) => {
      const s = Math.max(0, Math.round(Number(sec) || 0));
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    },
    compact: (n) => {
      const num = Number(n) || 0;
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1)}M`;
      if (num >= 1_000) return `${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1)}K`;
      return String(num);
    },
    plural: (count, singular, plural) => (count === 1 ? singular : plural || `${singular}s`),
  },

  // Seed the store from the static JSON (D21 read path) + restore persisted state
  // before navigation #0. loadAll upserts by primary key and notifies subscribers,
  // so it must never run inside data(). beforeMount is awaited, so the store is
  // fully populated before the first data() runs — a missing record is genuinely
  // not-found, not a mid-load blank (SPEC §16/§30).
  async beforeMount(app) {
    await Promise.all([
      app.store.loadAll('artist').catch((err) => console.error('[music] artist seed failed:', err)),
      app.store.loadAll('album').catch((err) => console.error('[music] album seed failed:', err)),
      app.store.loadAll('track').catch((err) => console.error('[music] track seed failed:', err)),
    ]);

    // Restore likes + last session from localStorage.
    const saved = loadState();
    for (const id of saved.likedIds) {
      const track = app.store.findOne('track', id);
      if (track) track.update({ liked: true });
    }

    // The single player record. Seed it from the saved session if one exists —
    // but never auto-resume playback (isPlaying stays false until the user hits
    // play), just restore what was cued and where it left off.
    const s = saved.session;
    app.store.createRecord('player', {
      id: 'session',
      currentTrackId: s?.currentTrackId || '',
      progressSec: s?.progressSec || 0,
      volume: typeof s?.volume === 'number' ? s.volume : 0.8,
      lastVolume: typeof s?.lastVolume === 'number' ? s.lastVolume : 0.8,
      shuffle: typeof s?.shuffle === 'boolean' ? s.shuffle : false,
      repeat: typeof s?.repeat === 'string' ? s.repeat : 'off',
      queue: Array.isArray(s?.queue) ? s.queue : [],
      // Recently-played album ids (newest first) drive the Home "Recently played"
      // row — restored so the shelf survives a reload.
      recentAlbumIds: Array.isArray(s?.recentAlbumIds) ? s.recentAlbumIds : [],
      isPlaying: false,
    });

    // The single local-only toast record (models/toast.js) — created at boot,
    // never persisted or fetched. Any surface flashes a message with
    // `store.findMany('toast')[0].show('…')`.
    app.store.createRecord('toast', { id: 'main' });

    // Restore saved playlists, or seed starters on first run. Like the player,
    // playlists are local-only store records (models/playlist.js) — created here,
    // never fetched. A saved array (even empty) means the user has playlist state
    // and we replay it verbatim; only a null (nothing ever persisted) seeds the
    // two starters, so the sidebar is never empty on a fresh visit.
    if (saved.playlists === null) {
      app.store.createRecord('playlist', {
        id: 'pl-night-drive',
        name: 'Night Drive',
        // Novaline synthpop + a couple of Lumen cuts — cyan→blue like Novaline.
        trackIds: ['t-neoncoast-1', 't-afterglow-1', 't-neoncoast-4', 't-driftwave-3', 't-halcyon-1'],
        accent: { from: '#22d3ee', to: '#3b82f6' },
        order: 0,
      });
      app.store.createRecord('playlist', {
        id: 'pl-after-midnight',
        name: 'After Midnight',
        // Koto Kudo late-night jazz — rose→amber like the Koto accent.
        trackIds: ['t-bluehour-1', 't-bluehour-3', 't-latenight-3', 't-latenight-4'],
        accent: { from: '#fb7185', to: '#f59e0b' },
        order: 1,
      });
    } else {
      for (const p of saved.playlists) {
        app.store.createRecord('playlist', {
          id: p.id,
          name: p.name,
          trackIds: Array.isArray(p.trackIds) ? p.trackIds : [],
          accent: p.accent || undefined,
          order: typeof p.order === 'number' ? p.order : 0,
        });
      }
    }

    // Persist a snapshot when the tab is hidden or closed (covers the dev server's
    // full-page live-reload too, so likes/position survive a rebuild). Wired here,
    // after the seed, so the records the snapshot reads always exist.
    const persist = () => {
      const player = app.store.findOne('player', 'session');
      saveState({
        likedIds: app.store.findMany('track').filter((t) => t.liked).map((t) => t.id),
        playlists: app.store.findMany('playlist').map((p) => ({
          id: p.id,
          name: p.name,
          trackIds: p.trackIds,
          accent: p.accent,
          order: p.order,
        })),
        session: player
          ? {
              currentTrackId: player.currentTrackId,
              progressSec: player.progressSec,
              volume: player.volume,
              lastVolume: player.lastVolume,
              shuffle: player.shuffle,
              repeat: player.repeat,
              queue: player.queue,
              recentAlbumIds: player.recentAlbumIds,
            }
          : null,
      });
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist();
    });
    window.addEventListener('beforeunload', persist);
  },
});

// Router-driven shared-element morph (v1.23, D55; D68): pairs elements that share
// a `data-puzzle-morph` value across route swaps — covers both the Artist page's
// Info button ↔ /artist/:id/info dialog shell (a live coexisting pair, button grows
// into the centered dialog and flies back on close) AND the card art ↔ detail header
// art flights on plain sibling view swaps (album/artist card → Album/Artist page),
// captured automatically at the route's leave phase in BOTH directions (browser
// back/forward included). No window scrollBehavior override: the app scrolls in an
// inner pane, so window scroll is inert. Note the Queue dialog deliberately does NOT
// use this — it's toggled by local layout state, which the router morph doesn't
// cover, so it drives its own MorphEngine by hand instead.
enableMorph(app);

app.mount();

export default app;
