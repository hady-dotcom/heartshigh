import * as migration_20261003_103330_initial from './20261003_103330_initial';
import * as migration_20261003_124500_integration_part1 from './20261003_124500_integration_part1';
import * as migration_20261003_131651_integration_part2 from './20261003_131651_integration_part2';
import * as migration_20261003_150000_harvest_moments from './20261003_150000_harvest_moments';

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
    up: migration_20261003_150000_harvest_moments.up,
    down: migration_20261003_150000_harvest_moments.down,
    name: '20261003_150000_harvest_moments',
  },
];
