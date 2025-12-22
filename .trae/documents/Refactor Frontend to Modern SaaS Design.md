# Frontend Refactor Plan: Modern SaaS UI (Revised)

This plan outlines the steps to refactor the `fucklib` frontend into a modern, responsive, SaaS-style application, incorporating specific user feedback on icon standardization, mobile layout fixes, and business logic preservation.

## 1. Setup & Dependencies
- **Install Utility Libraries:** Install `clsx` and `tailwind-merge` for cleaner class name management.
- **Icon Standardization:**
    - Strictly use `lucide-react` (already installed) for all icons.
    - Standardize imports (e.g., `import { IconName } from 'lucide-react'`).
    - Replace any inconsistent icon usage with Lucide equivalents.
- **Global Styles:** Update `index.css` to set the default background to `Slate-50`.

## 2. Layout & Navigation Refactor (`src/components/Layout.tsx`)
- **Responsive Design:**
    - **Desktop:** Sidebar navigation with Indigo-600 active states, rounded-lg items, and shadow-sm.
    - **Mobile:** Fixed Bottom Navigation Bar (`fixed bottom-0 w-full`).
- **Occlusion Fix:**
    - Apply `pb-20` (padding-bottom) to the main content container on mobile screens (`md:pb-0`) to ensure the last item is visible above the bottom navigation bar.
- **Structure:**
    - Main content area will use a Bento Grid-friendly container.

## 3. Dashboard Page (`src/pages/Dashboard.tsx`)
- **Grid Layout:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with `gap-6`.
- **Visuals:**
    - **User Card:** Bento style, Status Badges for Cookie/Bluetooth.
    - **Quick Seat:** Large card, hover lift effect (`-translate-y-1`).
    - **Task Radar:** Visual progress representation.
- **Logic:** Preserve all data fetching and state management (`useEffect`, `fetchData`).

## 4. Interactive Reservation Page (`src/pages/InteractiveReserve.tsx`)
- **Strict Logic Protection:**
    - Retain all `handleReserve`, `handleLibChange`, `handleCancel` functions exactly as is.
    - Add comments to mark critical business logic sections.
- **UI Overhaul:**
    - **Sticky Header:** `sticky top-0 z-10 bg-slate-50/80 backdrop-blur`.
    - **Visual Seat Map:** Refactor the seat grid to look like a map (rounded cells, specific colors for states: Idle, Mine, Unavailable, Reserved).
    - **Floating Action Bar (Mobile):** Fixed bottom bar for the "Bluetooth Sign-in" button, ensuring it sits above the global navigation if present (or replaces it in this specific view if needed, but standard bottom nav usually remains). *Correction: The specific page requirement asks for a Floating Action Bar. I will ensure it stacks correctly with the global bottom nav or I will hide the global nav on this specific page if it feels too crowded, but standard practice is to have the FAB float above.*

## 5. Scheduled Tasks Page (`src/pages/ScheduledTasks.tsx`)
- **Responsive View:**
    - **Desktop:** Table layout.
    - **Mobile:** Card List layout.
- **Components:**
    - Pure Tailwind CSS Toggle Switch for `is_enabled`.
    - Cron expression badges.

## 6. Settings Page (`src/pages/Settings.tsx`)
- **Layout:** `max-w-2xl mx-auto`.
- **Admin Zone:** Dedicated section with `border-red-100 bg-red-50/30` styling for Invite/User management.

## 7. Verification
- **Visual:** Check mobile content visibility (padding fix).
- **Functional:** Test the reservation flow to ensure no logic was broken.
