import * as migration_20261003_103330_initial from './20261003_103330_initial';
import * as migration_20261003_124500_integration_part1 from './20261003_124500_integration_part1';
import * as migration_20261003_131651_integration_part2 from './20261003_131651_integration_part2';
import * as migration_20261003_140611_harvest from './20261003_140611_harvest';
import * as migration_20261003_180616_jibril_doors from './20261003_180616_jibril_doors';
import * as migration_20261003_200853_integration_final from './20261003_200853_integration_final';
import * as migration_20261003_194500_line_tidy from './20261003_194500_line_tidy';
import * as migration_20261003_220000_feedback from './20261003_220000_feedback';
import * as migration_20261004_060000_shorts from './20261004_060000_shorts';
import * as migration_20261004_061000_portal_time_zone from './20261004_061000_portal_time_zone';
import * as migration_20261004_080000_lesson_picture_flags from './20261004_080000_lesson_picture_flags';
import * as migration_20261005_013000_media_privacy from './20261005_013000_media_privacy';

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
    up: migration_20261003_194500_line_tidy.up,
    down: migration_20261003_194500_line_tidy.down,
    name: '20261003_194500_line_tidy',
  },
  {
    up: migration_20261003_220000_feedback.up,
    down: migration_20261003_220000_feedback.down,
    name: '20261003_220000_feedback',
  },
  {
    up: migration_20261004_060000_shorts.up,
    down: migration_20261004_060000_shorts.down,
    name: '20261004_060000_shorts',
  },
  {
    up: migration_20261004_061000_portal_time_zone.up,
    down: migration_20261004_061000_portal_time_zone.down,
    name: '20261004_061000_portal_time_zone',
  },
  {
    up: migration_20261004_080000_lesson_picture_flags.up,
    down: migration_20261004_080000_lesson_picture_flags.down,
    name: '20261004_080000_lesson_picture_flags',
  },
  {
    up: migration_20261005_013000_media_privacy.up,
    down: migration_20261005_013000_media_privacy.down,
    name: '20261005_013000_media_privacy',
  },
];
