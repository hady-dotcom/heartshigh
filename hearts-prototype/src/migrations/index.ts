import * as migration_20261003_103330_initial from './20261003_103330_initial';
import * as migration_20261003_124500_integration_part1 from './20261003_124500_integration_part1';
import * as migration_20261003_131651_integration_part2 from './20261003_131651_integration_part2';
import * as migration_20261003_140611_harvest from './20261003_140611_harvest';
import * as migration_20261003_180616_jibril_doors from './20261003_180616_jibril_doors';
import * as migration_20261003_200853_integration_final from './20261003_200853_integration_final';
import * as migration_20261003_220000_feedback from './20261003_220000_feedback';

export const migrations = [
  {
    up: migration_20261003_103330_initial.up,
    down: migration_20261003_103330_initial.down,
    name: '20261003_103330_initial',
  },
  {
    up: migration_20261003_124500_integration_part1.up,
    down: migration_20261003_124500_integration_part1.down,
    name: '20261003_124500_integration_part1',
  },
  {
    up: migration_20261003_131651_integration_part2.up,
    down: migration_20261003_131651_integration_part2.down,
    name: '20261003_131651_integration_part2',
  },
  {
    up: migration_20261003_140611_harvest.up,
    down: migration_20261003_140611_harvest.down,
    name: '20261003_140611_harvest',
  },
  {
    up: migration_20261003_180616_jibril_doors.up,
    down: migration_20261003_180616_jibril_doors.down,
    name: '20261003_180616_jibril_doors',
  },
  {
    up: migration_20261003_200853_integration_final.up,
    down: migration_20261003_200853_integration_final.down,
    name: '20261003_200853_integration_final'
  },
  {
    up: migration_20261003_220000_feedback.up,
    down: migration_20261003_220000_feedback.down,
    name: '20261003_220000_feedback',
  },
];
