# Design Guidelines: Warehouse Appointment Management System

## Design Approach

**Selected Approach:** Design System - Microsoft Fluent Design

**Justification:** This is a utility-focused, data-intensive productivity application where clarity, efficiency, and information hierarchy are paramount. Fluent Design excels at:
- Dense information displays with excellent readability
- Scheduling and calendar interfaces
- Real-time data visualization
- Clear role-based UI differentiation
- Enterprise-grade form controls and validation feedback

**Key Design Principles:**
1. **Clarity Over Decoration** - Every element serves a functional purpose
2. **Scannable Information** - Users should quickly assess capacity and conflicts
3. **Progressive Disclosure** - Show critical info first, details on demand
4. **Consistent Feedback** - Clear validation states and error messaging

## Core Design Elements

### A. Typography

**Font Families:**
- Primary: 'Segoe UI', system-ui, -apple-system (Fluent's native stack)
- Monospace: 'SF Mono', 'Consolas' (for times, metrics, capacity numbers)

**Hierarchy:**
- H1 (Page titles): text-3xl, font-semibold
- H2 (Section headers): text-2xl, font-semibold  
- H3 (Card/panel titles): text-lg, font-semibold
- Body: text-base, font-normal
- Small labels: text-sm, font-medium
- Metrics/numbers: text-sm to text-lg, font-mono, font-semibold
- Timestamps: text-xs to text-sm, font-mono

### B. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16

**Grid Structure:**
- Main layout: Sidebar (w-64) + Content area (flex-1)
- Calendar grid: Native FullCalendar with 8-unit padding between slots
- Form layouts: gap-6 between form groups, gap-4 within groups
- Card spacing: p-6 for content, p-4 for compact cards

**Responsive Breakpoints:**
- Mobile: Stack sidebar, collapsible menu
- Tablet (md:): Side-by-side with narrow sidebar
- Desktop (lg:+): Full layout with expanded sidebar

### C. Component Library

#### Navigation & Layout

**Top Bar:**
- Fixed height: h-16
- Contents: Logo/brand (left), current date/time display (center-left), user menu with role badge (right)
- Role indicator: Small badge next to username showing "Admin", "Planner", or "View Only"

**Sidebar Navigation:**
- Full height with sections: Calendar, Appointments List, Capacity Management, Providers (planner+), Users (admin only)
- Active state: Subtle background treatment with left border accent (4px)
- Collapsed state on mobile with hamburger icon

**Main Content Area:**
- Max-width container: max-w-7xl mx-auto
- Padding: px-6 py-8
- Section spacing: space-y-8

#### Calendar Interface

**FullCalendar Customization:**
- Day/Week view toggle in toolbar (segmented control pattern)
- Time grid with 30-minute increments as default
- Appointment cards within calendar slots:
  - Rounded corners (rounded-md)
  - Provider name as header (text-sm font-semibold)
  - Time range in monospace (text-xs)
  - Capacity indicators as small badges at bottom
  - Truncate long text with ellipsis

**Capacity Indicator Strip (Above Calendar):**
- Horizontal bar showing current time window
- Three metric cards in a row (grid-cols-3):
  - Work Minutes: "2.5 / 3.0 min/min" with progress bar
  - Forklifts: "2 / 3" with icon count visualization
  - Docks: "2 / 3" (if enabled)
- Each card: p-4, rounded-lg, with icon, label, and fraction display

#### Forms & Modals

**Appointment Creation/Edit Modal:**
- Two-column layout on desktop (grid-cols-2), single on mobile
- Left column: Provider selection, time range (date + time pickers)
- Right column: Work minutes needed, forklifts needed, optional fields (goods type, units, lines)
- Inline validation with icons (checkmark/warning)
- Footer: Cancel (text button) + Save (primary button) with loading state

**Capacity Window Editor:**
- Table view with inline editing
- Columns: Start Time | End Time | Workers | Forklifts | Docks | Actions
- "Duplicate to Week" button above table (secondary style)
- Add new row button (primary outline style)

**Error Modal (Capacity Conflict):**
- Clear heading: "Appointment Cannot Be Scheduled"
- Body structure:
  - Conflict time display (large, monospace)
  - Capacity breakdown table (3 columns: Resource | Used | Available)
  - Suggested actions as bullet list
- Single dismissal button

#### Data Display Components

**Appointment Card (List View):**
- Compact layout: p-4
- Header row: Provider name + time range
- Metadata row: Small badges for work minutes, forklifts, goods type
- Footer: Quick actions (edit/delete for planner+)

**Capacity Window Card:**
- Table row style with hover state
- Time range in monospace on left
- Metric badges on right
- Edit icon button (appears on hover for planner+)

**Provider List Items:**
- Simple list with dividers
- Provider name + appointment count badge
- Click to filter calendar view

#### Interactive Elements

**Buttons:**
- Primary: Medium weight, rounded-md, px-6 py-2.5
- Secondary: Outlined variant with same dimensions  
- Text/Ghost: No background, medium font-weight
- Icon-only: Square (h-10 w-10), rounded-md

**Form Inputs:**
- Height: h-10 for text inputs, h-11 for select dropdowns
- Padding: px-4
- Borders: 1px with rounded-md
- Focus: Ring offset pattern (ring-2 ring-offset-1)

**Date/Time Pickers:**
- Use shadcn/ui calendar component
- Time selection: 15-minute increment dropdowns or number input with AM/PM
- Combined datetime: Side-by-side date picker + time input

**Badges:**
- Small size: px-2 py-1, text-xs, rounded
- Medium size: px-3 py-1.5, text-sm, rounded-md
- Role badges: Uppercase text, letter-spacing tracking-wide

**Progress Indicators:**
- Capacity bars: Height h-2, rounded-full, with background track
- Visual threshold indicators at 75% and 90% capacity
- Loading spinners: Size varies (h-4 to h-8) based on context

#### Overlays & Feedback

**Toast Notifications:**
- Position: Fixed top-right with stacking
- Width: max-w-sm
- Padding: p-4
- Auto-dismiss: 5 seconds (error), 3 seconds (success)
- Icon + message + close button

**Confirmation Dialogs:**
- Centered modal, max-w-md
- Clear question in heading
- Explanation text in body
- Two-button footer: Cancel (secondary) + Confirm action (primary or destructive)

**Role-Based UI States:**
- Read-only mode (basic_readonly): All form inputs disabled, edit/delete buttons hidden, visual "View Only" watermark in corner
- Planner mode: Full calendar + capacity editing, no user management
- Admin mode: All features unlocked

## Layout Examples

**Calendar Page Layout:**
```
┌─────────────────────────────────────────┐
│ Top Bar (Logo | Date/Time | User+Role) │
├──────────┬──────────────────────────────┤
│          │  Capacity Indicators (3 cols)│
│ Sidebar  │  ┌──────────────────────────┐│
│          │  │                          ││
│ - Cal    │  │   FullCalendar           ││
│ - Appts  │  │   (Day/Week View)        ││
│ - Cap    │  │                          ││
│ - Prov   │  │   [Appointment Cards]    ││
│          │  │                          ││
│          │  └──────────────────────────┘│
└──────────┴──────────────────────────────┘
```

**Capacity Management Page:**
```
┌─────────────────────────────────────────┐
│ Capacity Windows                [+ Add] │
├─────────────────────────────────────────┤
│ Table with inline editing:              │
│ Start | End | Workers | Forklifts | ... │
│ ────────────────────────────────────────│
│ 08:00 | 20:00 |   3   |     2     | [✏]│
│                                          │
│ [Duplicate Today → Full Week]           │
└─────────────────────────────────────────┘
```

## Animations

**Minimal, Purposeful Animations:**
- Modal entry/exit: Fade + slight scale (150ms)
- Toast notifications: Slide from right (200ms)
- Calendar event drag: Live position update, no easing
- Capacity bar fill: Smooth transition on data update (300ms)
- Hover states: Instant (no transition)
- Loading states: Spinner rotation only

**No Animations:**
- Page transitions
- Sidebar collapse/expand (instant)
- Calendar view switching
- Form field focus states