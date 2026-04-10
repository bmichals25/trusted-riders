# Mission Screen Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a frontend-only React Native prototype where tapping the current ride map opens a dedicated mission screen.

**Architecture:** Use Expo Router with two routes. Keep all rider, trip, and stage data local in shared mock data, and model overlays with route-local React state for quick prototype iteration.

**Tech Stack:** Expo, Expo Router, React Native, TypeScript, expo-linear-gradient

---

### Task 1: Bootstrap App Shell

**Files:**
- Create: `package.json`
- Create: `app.json`
- Create: `babel.config.js`
- Create: `tsconfig.json`
- Create: `expo-env.d.ts`

**Step 1:** Define Expo and Router dependencies.

**Step 2:** Add TypeScript and path alias configuration.

**Step 3:** Configure Expo Router entry and Babel plugin.

### Task 2: Build Shared UI Foundation

**Files:**
- Create: `lib/theme.ts`
- Create: `lib/mock-data.ts`
- Create: `components/ui/gradient-card.tsx`

**Step 1:** Add a shared palette and spacing tokens.

**Step 2:** Add local mission and list data to drive both screens.

**Step 3:** Create one reusable gradient container for branded cards and actions.

### Task 3: Build Home Dashboard

**Files:**
- Create: `app/index.tsx`

**Step 1:** Recreate the home screen sections from the supplied concept.

**Step 2:** Add modal drawers for rider details, directions, and settings.

**Step 3:** Make the map area visibly tappable and route to the mission screen.

### Task 4: Build Mission Screen

**Files:**
- Create: `app/mission.tsx`

**Step 1:** Recreate the full-screen mission map experience with floating HUD.

**Step 2:** Add bottom-sheet-like content and mission stage progression.

**Step 3:** Add the rider protocol modal.

### Task 5: Sanity Check

**Files:**
- Review: `app/index.tsx`
- Review: `app/mission.tsx`
- Review: `components/ui/gradient-card.tsx`
- Review: `lib/mock-data.ts`
- Review: `lib/theme.ts`

**Step 1:** Verify route imports and local state wiring.

**Step 2:** Confirm all screens use the shared data consistently.

**Step 3:** Document how to run the prototype.
