import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

export default class Artist extends PuzzleModel {
  // Schema — see constellation/doc/DOC-SPEC.md §7. This example leans on the
  // schema types the todos/blog apps never touch: number (followers,
  // monthlyListeners) and object (accent). `genre` uses .oneOf() as an enum and
  // `monthlyListeners` uses .min(); validation *enforcement* is deferred in v1,
  // but declaring the rules is the documented shape.
  static schema = {
    id:               Puzzle.string().primary(),
    name:             Puzzle.string().required(),
    genre:            Puzzle.string().oneOf(['Electronic', 'Indie Folk', 'Synthpop', 'Jazz']),
    followers:        Puzzle.number().default(0),
    monthlyListeners: Puzzle.number().min(0).default(0),
    bio:              Puzzle.string().default(''),
    // A Puzzle.object() field: the two-stop gradient used for the artist's
    // artwork. Seeded from JSON as a real nested object.
    accent:           Puzzle.object().default(() => ({ from: '#3a3a44', to: '#22222a' })),
  };

  // Computed getters (plain JS). initials drives the avatar fallback; artwork
  // turns the accent object into a ready-to-use CSS gradient so templates read
  // `style="background:{ artist.artwork }"` instead of rebuilding it each time.
  get initials() {
    return String(this.name)
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  get artwork() {
    const a = this.accent || {};
    return `linear-gradient(135deg, ${a.from || '#3a3a44'}, ${a.to || '#22222a'})`;
  }

  // Server location (D21): consumed by store.loadAll('artist') on the read path.
  static adapter = {
    endpoint: '/artists.json',
  };
}
