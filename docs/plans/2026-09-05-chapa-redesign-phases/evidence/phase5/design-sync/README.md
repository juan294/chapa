# Local design-sync verification

All 15 existing standalone exports were rendered in both themes with their
actual preview props, current compiled CSS and locally copied built fonts.
See `manifest.json`, `verification.json`, the 30 component captures and three
reviewed contact sheets. The active-index story uses its documented desktop
width so its responsive visibility is represented honestly.

Generated CSS, fonts, token output and the temporary Vite gallery remain
ignored. The portable source/config and exact handoff recipe are in
`.design-sync/NOTES.md`. This is local component verification only. Converter,
Claude Design upload and remote readback were not executed because the
capability is unavailable in this session.
