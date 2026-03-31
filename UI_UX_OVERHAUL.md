# UI/UX Overhaul

## Phase 1 - Audit

### P0 - Critical UX problems
- Header, content shell, and bottom navigation were using unrelated spacing rules, causing weak alignment and inconsistent safe-area handling.
- Core page shells mixed `px-4`, `px-6`, manual `max-w-*`, and custom margins, so the app did not present one stable container rhythm.
- Event browsing and profile views were visually dense and action-heavy on mobile; CTAs were competing instead of sequencing.
- Cards and action surfaces had inconsistent radii, shadows, and internal padding, which made the UI feel stitched together instead of product-grade.
- Event list cards still relied on an overlay-link pattern with UI chrome layered on top, which made the interaction model harder to reason about.

### P1 - Major layout problems
- Hero, filter, and dashboard sections had weak top-level hierarchy; headings, support copy, and supporting metrics lacked predictable spacing.
- Forms mixed business logic and presentation concerns with ad hoc field wrappers and inconsistent label spacing.
- Loading, empty, and error states were technically shared but visually underpowered relative to the rest of the product.
- Mobile tabs and page panels were functional but not visually grouped into a cohesive information architecture.

### P2 - Visual improvements
- Typography scale lacked a disciplined display / section / body progression.
- Background treatments were effective but noisy and inconsistent from page to page.
- Supporting surfaces needed a more restrained neutral system and cleaner shadows.
- CTA buttons needed one clear primary treatment and a quieter secondary treatment.

### P3 - Polish enhancements
- Skeletons needed to better mirror final layouts.
- Motion and hover states were present but not systematized.
- Footer and navigation could communicate product confidence better with improved grouping.

### P4 - Nice-to-have upgrades
- Full theme switching is now token-ready but still not exposed to users.
- Additional page-level refactors for admin tables and long-form legal pages can now build on the same primitives.

## Phase 2 - Spacing system extracted from the reference

The reference screenshot was used only for layout discipline and spacing rhythm.

- Container padding: 20px mobile, 24-32px tablet/laptop, 40px desktop
- Section spacing: 48px mobile, 64px tablet, 96px desktop, 128px for major hero-to-next-section transitions
- Card grid gap: 24px standard, 32px between larger stacked sections
- Hero proportions: roughly 60/40 content-to-supporting-rail on desktop
- Heading to paragraph: 16px
- Paragraph to actions: 24px
- Action group to supporting meta: 24px
- Vertical rhythm: 8 / 16 / 24 / 32 / 48 / 64 / 96 / 128

### Tokens
- 4px
- 8px
- 12px
- 16px
- 24px
- 32px
- 48px
- 64px
- 96px
- 128px

## Phase 3 - Design system

### Color system
- Dark-first neutral surfaces with restrained cyan and emerald accents
- Future light-mode token overrides added in CSS variables
- Stronger border hierarchy and softer layered shadows

### Typography scale
- Display: `--text-display`
- H1: `--text-h1`
- H2: `--text-h2`
- H3: `--text-h3`
- Body large: `--text-body-lg`
- Body: `--text-body`
- Caption / label: `--text-caption`, `--text-label`

### Core primitives
- `Card`
- `Button`
- `Input`
- `Select`
- `Textarea`
- `Badge`
- `EmptyState`
- `ErrorState`
- `Skeleton`
- `ConfirmDialog`
- Layout primitives in `app/components/ui/primitives.tsx`

## Phase 4 - Layout framework
- Stable `page-container` and `site-container`
- Shared `PageShell`
- Primitive layout components:
  - `Container`
  - `Section`
  - `Stack`
  - `Cluster`
  - `ResponsiveGrid`
  - `PageIntro`
  - `SurfacePanel`

## Phase 5 - Mobile-first responsive rules
- Bottom nav converted into a dock-style mobile control rather than a full-width slab
- Shared card and panel padding scales down cleanly on mobile
- Event grids now use 1 / 2 / 3 column progression
- Form layout and event discovery controls stack vertically first, then expand outward

## Phase 6 - Navigation and IA improvements
- Header now uses a single disciplined surface with clearer grouping
- Desktop nav uses quieter pills; mobile nav uses a cleaner dock treatment
- Profile tabs and my-ticket tabs are now visually grouped and easier to scan
- Event discovery now has a clearer intro -> filters -> map -> results progression

## Phase 7 - Component refactor summary
- Shared tokens centralized in `app/globals.css`
- Layout primitives created in `app/components/ui/primitives.tsx`
- Main shared UI components restyled to one system
- Home, events, profile, payments, and create-event surfaces refactored to consume the same design language

## Phase 8 - Visual polish
- Stronger surface hierarchy
- Cleaner whitespace
- Better CTA contrast
- Smoother hover and elevation behavior
- Better skeleton fidelity

## Phase 9 - Performance / maintainability notes
- Refactor stayed UI-focused and preserved business logic
- Shared component improvements reduce duplicated styling logic
- Heavy logic hooks were left intact; UI was separated where possible without destabilizing flows

## Phase 10 - Implemented pages and components

### Updated foundation
- `app/globals.css`
- `app/components/ui/primitives.tsx`
- `app/components/ui/button.tsx`
- `app/components/ui/card.tsx`
- `app/components/ui/input.tsx`
- `app/components/ui/select.tsx`
- `app/components/ui/textarea.tsx`
- `app/components/ui/badge.tsx`
- `app/components/ui/table.tsx`
- `app/components/ui/page-shell.tsx`
- `app/components/ui/empty-state.tsx`
- `app/components/ui/error-state.tsx`
- `app/components/ui/skeleton.tsx`
- `app/components/ui/confirm-dialog.tsx`

### Updated major surfaces
- `app/components/HeaderNav.tsx`
- `app/components/Footer.tsx`
- `app/components/landing/LandingHome.tsx`
- `app/components/EventCard.tsx`
- `app/events/EventFilterBar.tsx`
- `app/events/page.tsx`
- `app/components/profile/ProfileHeader.tsx`
- `app/components/profile/ProfileDashboard.tsx`
- `app/components/profile/RegisteredEventsTab.tsx`
- `app/components/profile/SavedEventsTab.tsx`
- `app/components/profile/MyEventsPanel.tsx`
- `app/components/register/RegisterPanel.tsx`
- `app/components/payments/ChapaStatusPanel.tsx`
- `app/create-events/page.tsx`
- `app/components/create-event/CreateEventForm.tsx`
- `app/components/create-event/EventFormPreview.tsx`

## Before vs After
- Before: each page carried its own spacing, surface, and CTA rules.
- After: one tokenized shell drives spacing, type, surface depth, and button hierarchy.
- Before: mobile navigation and page content competed for space.
- After: safe-area-aware header and docked mobile nav use a shared rhythm.
- Before: home, events, profile, and create-event felt like separate products.
- After: they now share one consistent visual language and layout cadence.

## Validation
- `npm run typecheck` passes
- `npm run lint` passes
