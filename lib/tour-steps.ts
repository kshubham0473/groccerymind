// lib/tour-steps.ts
// Step-by-step tour definition. Each step targets a CSS selector on a specific page.
// The tour tells a story: "It's Monday morning. Here's how GroceryMind helps."

export interface TourStep {
  id: string
  page: string                    // route to navigate to before showing step
  selector: string                // CSS selector for the element to spotlight
  title: string
  body: string
  position: 'top' | 'bottom' | 'center'  // tooltip position relative to spotlight
  spotlightPadding?: number       // extra padding around spotlighted element (default 8)
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    page: '/dashboard',
    selector: '[data-tour="header"]',
    title: "Welcome to GroceryMind 👋",
    body: "It's Monday morning. Let's walk through how this app helps you plan meals, track your pantry, and cut down on ordering stress. Takes 2 minutes.",
    position: 'bottom',
    spotlightPadding: 0,
  },
  {
    id: 'todays-decision',
    page: '/dashboard',
    selector: '[data-tour="todays-decision"]',
    title: "Today's Decision",
    body: "Every day, you decide what you're making — lunch and dinner. Once you choose, it locks in so both of you are on the same page. Tap 'Choose →' when you're ready.",
    position: 'bottom',
  },
  {
    id: 'dashboard-insight',
    page: '/dashboard',
    selector: '[data-tour="insight-card"]',
    title: "Your Cooking Insights",
    body: "GroceryMind tracks what you cook and surfaces interesting patterns — streaks, favourites, cook rate. Gets richer the more you use it.",
    position: 'bottom',
  },
  {
    id: 'meal-plan-days',
    page: '/meal-plan',
    selector: '[data-tour="day-selector"]',
    title: "Your Weekly Rotation",
    body: "This is your meal plan — 7 days, lunch and dinner. Dishes are pre-assigned from your onboarding. Tap any day to see options and lock in a decision.",
    position: 'bottom',
  },
  {
    id: 'meal-plan-dish',
    page: '/meal-plan',
    selector: '[data-tour="meal-slot"]',
    title: "Choosing a Dish",
    body: "Each slot shows the dishes in your rotation for that day. Tap the dish name to see the YouTube recipe. Tap 'Choose →' to lock it in — your partner sees it instantly.",
    position: 'top',
  },
  {
    id: 'discover-search',
    page: '/discover',
    selector: '[data-tour="discover-input"]',
    title: "Discover Something New",
    body: "Craving something specific? Describe it — 'something light with paneer' or 'quick South Indian'. GroceryMind searches your recipe library and ranks the best matches.",
    position: 'bottom',
  },
  {
    id: 'discover-pantry-toggle',
    page: '/discover',
    selector: '[data-tour="pantry-toggle"]',
    title: "Cook from What You Have",
    body: "Tap 'Pantry only' to filter suggestions to dishes you can make right now — no ordering needed. Great for a Tuesday night when you don't want to think too hard.",
    position: 'bottom',
  },
  {
    id: 'pantry-shelf',
    page: '/pantry',
    selector: '[data-tour="pantry-shelf"]',
    title: "Your Pantry",
    body: "Everything in your kitchen, organised by shelf life — fresh, weekly, monthly. Tap any item to mark it low or finished. Finished items go straight to your order list.",
    position: 'bottom',
  },
  {
    id: 'pantry-add',
    page: '/pantry',
    selector: '[data-tour="pantry-add"]',
    title: "Adding Items",
    body: "Tap here to add something new. Start typing and GroceryMind auto-detects the category — sweet corn goes under Vegetables, dahi under Dairy. You can always override it.",
    position: 'top',
  },
  {
    id: 'orders',
    page: '/orders',
    selector: '[data-tour="order-list"]',
    title: "Your Order List",
    body: "Finished pantry items and dishes from Discover flow here automatically. When you're ready to order from Blinkit or Zepto, everything is in one place.",
    position: 'bottom',
  },
  {
    id: 'done',
    page: '/dashboard',
    selector: '[data-tour="header"]',
    title: "You're all set ✓",
    body: "Cook, log meals with 'Cooked ✓', and GroceryMind gets better at suggesting what you'll actually make. You can revisit this tour anytime from Settings → Help.",
    position: 'bottom',
    spotlightPadding: 0,
  },
]

export const TOUR_STORAGE_KEY = 'gm_tour_seen'
export const TOUR_STEP_KEY    = 'gm_tour_step'
