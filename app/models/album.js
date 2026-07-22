import { PuzzleModel, Puzzle } from '@magic-spells/puzzle';

export default class Album extends PuzzleModel {
  // `year` shows the numeric range modifiers (.min/.max) and a custom .validate()
  // escape hatch. `accent` is another Puzzle.object() gradient. Track membership
  // is not stored here — tracks reference their album by albumId, and views join
  // them via store.findMany({ filter }), which keeps the source of truth in one
  // place and lets an album's duration be derived where the store is available.
  static schema = {
    id:       Puzzle.string().primary(),
    title:    Puzzle.string().required(),
    artistId: Puzzle.string().required(),
    year:     Puzzle.number()
                .min(1950)
                .max(2030)
                .validate((v) => Number.isInteger(v), 'year must be a whole number'),
    mood:     Puzzle.array().default(() => []),
    accent:   Puzzle.object().default(() => ({ from: '#3a3a44', to: '#22222a' })),
  };

  get artwork() {
    const a = this.accent || {};
    return `linear-gradient(135deg, ${a.from || '#3a3a44'}, ${a.to || '#22222a'})`;
  }

  // Decade label, e.g. "2020s" — a small computed getter used on the album page.
  get era() {
    const y = Number(this.year);
    return Number.isFinite(y) ? `${Math.floor(y / 10) * 10}s` : '';
  }

  static adapter = {
    endpoint: '/albums.json',
  };
}
