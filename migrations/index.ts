import * as migration_20260915_102128_initial from './20260915_102128_initial';

export const migrations = [
  {
    up: migration_20260915_102128_initial.up,
    down: migration_20260915_102128_initial.down,
    name: '20260915_102128_initial'
  },
];
