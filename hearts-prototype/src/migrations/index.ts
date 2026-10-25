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
import * as migration_20261004_120000_compass_v2 from './20261004_120000_compass_v2';
import * as migration_20261004_031500_gather from './20261004_031500_gather';
import * as migration_20261004_180000_gather_entry_code from './20261004_180000_gather_entry_code';
import * as migration_20261004_180100_framing_track from './20261004_180100_framing_track';
import * as migration_20261004_180500_experiments from './20261004_180500_experiments';
import * as migration_20261004_210000_schedule_minutes from './20261004_210000_schedule_minutes';
import * as migration_20261004_210100_live_sessions from './20261004_210100_live_sessions';
import * as migration_20261004_210500_insights_missions from './20261004_210500_insights_missions';
import * as migration_20261004_230000_portal_features from './20261004_230000_portal_features';
import * as migration_20261004_235900_insight_privacy from './20261004_235900_insight_privacy';
import * as migration_20261005_010000_swarm_hidden from './20261005_010000_swarm_hidden';
import * as migration_20261005_120000_safety from './20261005_120000_safety';
import * as migration_20261005_121000_safety_locks from './20261005_121000_safety_locks';
import * as migration_20261005_161000_portal_extra_scenes from './20261005_161000_portal_extra_scenes';
import * as migration_20261009_191000_portal_ai_connection from './20261009_191000_portal_ai_connection';
import * as migration_20261011_120000_bring_in_round2 from './20261011_120000_bring_in_round2';
import * as migration_20261013_190000_teach_seen from './20261013_190000_teach_seen';
import * as migration_20261014_120000_portal_ai_forks from './20261014_120000_portal_ai_forks';
import * as migration_20261014_150000_short_talks from './20261014_150000_short_talks';
import * as migration_20261014_210000_experiment_duration from './20261014_210000_experiment_duration';
import * as migration_20261014_220000_transcript_edits from './20261014_220000_transcript_edits';
import * as migration_20261014_231000_learner_desk from './20261014_231000_learner_desk';
import * as migration_20261014_233000_reply_done from './20261014_233000_reply_done';
import * as migration_20261014_235000_see_how_clips from './20261014_235000_see_how_clips';
import * as migration_20261015_120000_desk_bin from './20261015_120000_desk_bin';
import * as migration_20261015_130000_code_courses from './20261015_130000_code_courses';
import * as migration_20261022_140000_vimeo_hash from './20261022_140000_vimeo_hash';
import * as migration_20261024_160000_lesson_bin from './20261024_160000_lesson_bin';
import * as migration_20261024_190000_sequence_portal from './20261024_190000_sequence_portal';
import * as migration_20261025_120000_parenting_demo from './20261025_120000_parenting_demo';
import * as migration_20261025_160000_hady_home from './20261025_160000_hady_home';
import * as migration_20261025_170000_vimeo_public from './20261025_170000_vimeo_public';
import * as migration_20261025_190000_course_answers from './20261025_190000_course_answers';

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
    name: '20261003_200853_integration_final',
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
  {
    up: migration_20261004_120000_compass_v2.up,
    down: migration_20261004_120000_compass_v2.down,
    name: '20261004_120000_compass_v2',
  },
  {
    up: migration_20261004_031500_gather.up,
    down: migration_20261004_031500_gather.down,
    name: '20261004_031500_gather',
  },
  {
    up: migration_20261004_180000_gather_entry_code.up,
    down: migration_20261004_180000_gather_entry_code.down,
    name: '20261004_180000_gather_entry_code',
  },
  {
    up: migration_20261004_180100_framing_track.up,
    down: migration_20261004_180100_framing_track.down,
    name: '20261004_180100_framing_track',
  },
  {
    up: migration_20261004_180500_experiments.up,
    down: migration_20261004_180500_experiments.down,
    name: '20261004_180500_experiments',
  },
  {
    up: migration_20261004_210000_schedule_minutes.up,
    down: migration_20261004_210000_schedule_minutes.down,
    name: '20261004_210000_schedule_minutes',
  },
  {
    up: migration_20261004_210100_live_sessions.up,
    down: migration_20261004_210100_live_sessions.down,
    name: '20261004_210100_live_sessions',
  },
  {
    up: migration_20261004_210500_insights_missions.up,
    down: migration_20261004_210500_insights_missions.down,
    name: '20261004_210500_insights_missions',
  },
  {
    up: migration_20261004_230000_portal_features.up,
    down: migration_20261004_230000_portal_features.down,
    name: '20261004_230000_portal_features',
  },
  {
    up: migration_20261004_235900_insight_privacy.up,
    down: migration_20261004_235900_insight_privacy.down,
    name: '20261004_235900_insight_privacy',
  },
  {
    up: migration_20261005_010000_swarm_hidden.up,
    down: migration_20261005_010000_swarm_hidden.down,
    name: '20261005_010000_swarm_hidden',
  },
  {
    up: migration_20261005_120000_safety.up,
    down: migration_20261005_120000_safety.down,
    name: '20261005_120000_safety',
  },
  {
    up: migration_20261005_121000_safety_locks.up,
    down: migration_20261005_121000_safety_locks.down,
    name: '20261005_121000_safety_locks',
  },
  {
    up: migration_20261005_161000_portal_extra_scenes.up,
    down: migration_20261005_161000_portal_extra_scenes.down,
    name: '20261005_161000_portal_extra_scenes',
  },
  {
    up: migration_20261009_191000_portal_ai_connection.up,
    down: migration_20261009_191000_portal_ai_connection.down,
    name: '20261009_191000_portal_ai_connection',
  },
  {
    up: migration_20261011_120000_bring_in_round2.up,
    down: migration_20261011_120000_bring_in_round2.down,
    name: '20261011_120000_bring_in_round2',
  },
  {
    up: migration_20261013_190000_teach_seen.up,
    down: migration_20261013_190000_teach_seen.down,
    name: '20261013_190000_teach_seen',
  },
  {
    up: migration_20261014_120000_portal_ai_forks.up,
    down: migration_20261014_120000_portal_ai_forks.down,
    name: '20261014_120000_portal_ai_forks',
  },
  {
    up: migration_20261014_150000_short_talks.up,
    down: migration_20261014_150000_short_talks.down,
    name: '20261014_150000_short_talks',
  },
  {
    up: migration_20261014_210000_experiment_duration.up,
    down: migration_20261014_210000_experiment_duration.down,
    name: '20261014_210000_experiment_duration',
  },
  {
    up: migration_20261014_220000_transcript_edits.up,
    down: migration_20261014_220000_transcript_edits.down,
    name: '20261014_220000_transcript_edits',
  },
  {
    up: migration_20261014_231000_learner_desk.up,
    down: migration_20261014_231000_learner_desk.down,
    name: '20261014_231000_learner_desk',
  },
  {
    up: migration_20261014_233000_reply_done.up,
    down: migration_20261014_233000_reply_done.down,
    name: '20261014_233000_reply_done',
  },
  {
    up: migration_20261014_235000_see_how_clips.up,
    down: migration_20261014_235000_see_how_clips.down,
    name: '20261014_235000_see_how_clips',
  },
  {
    up: migration_20261015_120000_desk_bin.up,
    down: migration_20261015_120000_desk_bin.down,
    name: '20261015_120000_desk_bin',
  },
  {
    up: migration_20261015_130000_code_courses.up,
    down: migration_20261015_130000_code_courses.down,
    name: '20261015_130000_code_courses',
  },
  {
    up: migration_20261022_140000_vimeo_hash.up,
    down: migration_20261022_140000_vimeo_hash.down,
    name: '20261022_140000_vimeo_hash',
  },
  {
    up: migration_20261024_160000_lesson_bin.up,
    down: migration_20261024_160000_lesson_bin.down,
    name: '20261024_160000_lesson_bin',
  },
  {
    up: migration_20261024_190000_sequence_portal.up,
    down: migration_20261024_190000_sequence_portal.down,
    name: '20261024_190000_sequence_portal',
  },
  {
    up: migration_20261025_120000_parenting_demo.up,
    down: migration_20261025_120000_parenting_demo.down,
    name: '20261025_120000_parenting_demo',
  },
  {
    up: migration_20261025_160000_hady_home.up,
    down: migration_20261025_160000_hady_home.down,
    name: '20261025_160000_hady_home',
  },
  {
    up: migration_20261025_170000_vimeo_public.up,
    down: migration_20261025_170000_vimeo_public.down,
    name: '20261025_170000_vimeo_public',
  },
  {
    up: migration_20261025_190000_course_answers.up,
    down: migration_20261025_190000_course_answers.down,
    name: '20261025_190000_course_answers',
  },
];
