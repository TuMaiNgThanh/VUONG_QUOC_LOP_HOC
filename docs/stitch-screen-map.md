# Stitch Screen Map

## Primary Mapping
- `unified_login_desktop` -> `scripts/pages/login/`
- `teacher_portal_dashboard_desktop` -> `scripts/pages/teacher-dashboard/`
- `student_portal_library_desktop` -> `scripts/pages/student-library/`
- `lesson_player_premium_refined_desktop` -> `scripts/pages/lesson-player/`
- `kingdom_leaderboard_desktop` -> `scripts/pages/team-showcase/`

## Reused Modules (Applied)
- `quests_assignments_desktop` -> quest summary widgets in `scripts/pages/student-library/`
- `kingdom_map_integrated_desktop` -> map progress card in `scripts/pages/student-library/`
- `teacher_class_management_desktop` -> class overview metric cards in `scripts/pages/teacher-dashboard/`

## Retired Stitch Variants (Removed)
- `lesson_player_premium_desktop`
- `student_library_connected_desktop`
- `student_library_refined_connected_desktop`
- `student_portal_lesson_player_desktop`
- `teacher_dashboard_connected_desktop`
- `teacher_dashboard_refined_connected_desktop`
- `kingdom_map_desktop`
- `classroom_kingdom_platform`
- `classroom_kingdom_portal_redesign`
- `student_profile_desktop`
- `untitled_prototype_1`
- `untitled_prototype_2`
- `untitled_prototype_3`

## Notes
- Keep one source-of-truth stitch variant per page.
- Document any deviations needed for Firebase data binding.
