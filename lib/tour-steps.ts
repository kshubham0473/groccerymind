// patch-4 · lib/tour-steps.ts
// Re-cut to seven steps against the patch-2a / patch-3 screens.
// Every selector below exists in those files once the data-tour
// attributes listed in README-PATCH.md are added. Discover is no longer
// a tab, so its two old steps are folded into step 5 on /meal-plan.

export interface TourStep {
  id: string
  page: string                    // route to navigate to before showing step
  selector: string                // CSS selector for the element to spotlight
  screen: string                  // printed in the sheet, mono — which screen you're on
  title: string
  body: string
  position: 'top' | 'bottom' | 'center'
  spotlightPadding?: number
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'tonight',
    page: '/dashboard',
    selector: '[data-tour="tonight"]',
    screen: 'Tonight',
    title: 'Tonight is the whole app',
    body: 'One question answered on open: what are we eating. Everything else — the week, the pantry, the list — exists to keep this line honest.',
    position: 'bottom',
    spotlightPadding: 4,
  },
  {
    id: 'commit',
    page: '/dashboard',
    selector: '[data-tour="commit"]',
    screen: 'Tonight',
    title: 'One dish, already chosen',
    body: "GroceryMind picks from your rotation and what's in the kitchen. Happy with it? Cook this. Not tonight? The arrow beside it hands you another.",
    position: 'bottom',
  },
  {
    id: 'news',
    page: '/dashboard',
    selector: '[data-tour="news"]',
    screen: 'Tonight',
    title: 'The kitchen keeps its own notes',
    body: "What's running low and what the others added shows up here as a sentence — no badge to decode, nothing to dismiss.",
    position: 'top',
  },
  {
    id: 'week',
    page: '/meal-plan',
    selector: '[data-tour="week"]',
    screen: 'Week',
    title: 'Seven days, one line each',
    body: 'Decided days show the dish, open days say so. Tap an open day to fill it from your rotation — today is the only line in ochre.',
    position: 'bottom',
  },
  {
    id: 'browse',
    page: '/meal-plan',
    selector: '[data-tour="browse"]',
    screen: 'Week',
    title: 'Looking for something else',
    body: "Browse all searches your whole library in plain words — 'something light with paneer'. Filter to what the pantry can already make, and add it straight to a day.",
    position: 'top',
  },
  {
    id: 'shelf',
    page: '/pantry',
    selector: '[data-tour="shelf"]',
    screen: 'Kitchen',
    title: 'Mark it low, it lands on the list',
    body: 'Your kitchen by shelf life. Tap an item to say low or finished — finished walks itself over to the list.',
    position: 'bottom',
  },
  {
    id: 'list',
    page: '/orders',
    selector: '[data-tour="list"]',
    screen: 'List',
    title: 'One tap to order what ran out',
    body: 'Everything finished collects here, ready for Blinkit or Zepto. That is the loop — cook, mark, order, repeat.',
    position: 'bottom',
  },
]

export const TOUR_STORAGE_KEY = 'gm_tour_seen'
export const TOUR_STEP_KEY    = 'gm_tour_step'
