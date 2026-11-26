# Clipper Studio UI and UX audit

## Findings

- The public landing and sign-in screens use distinct page layouts. The primary workspace had twelve tool groups behind one picker. Project, clip, and tool labels sometimes competed for the same level of navigation.
- On a new workspace, Home displayed separate empty tiles for the last project, recent projects, and recent clips. At 390 px, these repeated empty states dominated the first screen.
- The import dialog already separates URL and upload sources and reports actual upload progress. A basic subtitle choice was buried behind advanced options.
- The editor already includes a timeline, contextual controls and rendered previews. Creative tools, media browsers, processing jobs and individual settings remain implemented behind the shared app shell.
- The earlier screenshot regression script assumed an unauthenticated dashboard and a flat sidebar, so it no longer represented the current user journey.

## Priorities and delivery

| Priority | Work | Status |
| --- | --- | --- |
| 1 | Establish visible Home, Projects, Clipping, Studio, Library, Automation, Production and Settings destinations with contextual tools | Implemented |
| 1 | Refocus Home on import, next actions and actual recent work | Implemented |
| 1 | Surface subtitle choice alongside clip count and length | Implemented |
| 2 | Standardize command navigation, loading states and account actions using shadcn and Radix | Implemented for the shell |
| 2 | Verify authenticated desktop and mobile navigation, account menu, keyboard search and quick import controls | Exercised with a synthetic account |
| 3 | Redesign individual editor, review, media and settings workflows and complete all language and accessibility journeys | Outstanding |

Baseline captures were taken from a separate app instance with a synthetic account. Files are stored in the ignored local tools directory. This phase preserves the current public pages and creative editors.

Browser review also identified a floating account control that covered the mobile navigation drawer. Account actions now live in the top toolbar. The full render smoke test exposed an invalid timed filter and an FFmpeg failure when scale and opacity were animated together. The effect arguments and filter order were corrected and the smoke test was rerun.
