# Clipper Studio design system

- **Surfaces** use the existing semantic dark and light CSS tokens in `app/tokens.css`. Workspace surfaces are matte. Accent color identifies active destinations, primary actions and focus.
- **Typography** uses Geist for the interface and Geist Mono for technical metadata. Primary content retains responsive headings and controls use concise labels.
- **Navigation** uses a 64 px workspace rail and a collapsible contextual panel. Mobile puts both inside the navigation drawer.
- **Controls** build on the customized shadcn components and Radix primitives. Shared buttons use CVA variants. Lucide icons inherit the surrounding text color and icon-only controls have accessible names.
- **Keyboard interactions** use shadcn Command with cmdk. The toolbar account menu uses Radix Dropdown Menu. The workspace loading state uses the shadcn Skeleton component.
- **Feedback** distinguishes loading, missing content, queued jobs, and actual processing progress. Empty workspaces show a next action. Motion respects the user’s reduced-motion preference.
