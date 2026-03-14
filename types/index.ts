export interface User {
  id: string
  username: string
  role: 'admin' | 'member'
  household_id: string
}

export interface Household {
  id: string
  name: string
  member_count: number
  preferences?: HouseholdPreferences
}

export interface HouseholdPreferences {
  // Identity
  member_names?: Record<string, string>
  // Food identity
  dietary?: string
  cuisine_prefs?: string[]
  dislikes?: string
  // Richer data points (new)
  meal_complexity?: string        // 'simple' | 'moderate' | 'elaborate'
  cooking_time?: string           // 'under 20 mins' | '20–40 mins' | 'no limit'
  meal_variety?: string           // 'same dishes' | 'moderate mix' | 'always new'
  spice_level?: string            // 'mild' | 'medium' | 'spicy'
  protein_prefs?: string[]        // ['paneer', 'dal', 'eggs', 'chicken', 'tofu', ...]
  meal_occasions?: string[]       // ['weekday lunch', 'weekday dinner', 'weekend special', 'guests']
  health_goals?: string[]         // ['high protein', 'low oil', 'gut-friendly', 'weight loss', 'no goals']
  texture_prefs?: string[]        // ['dry sabzi', 'gravy dishes', 'rice meals', 'breads', 'one-pot']
  // App config
  quickcommerce?: ('blinkit' | 'zepto' | 'swiggy' | 'bigbasket')[]
  onboarding_complete?: boolean
}

export interface Dish {
  id: string
  household_id: string
  name: string
  cuisine_type?: string
  protein_type?: string
  ingredients: string[]
}

export interface MealSlot {
  id: string
  household_id: string
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  slot: 'lunch' | 'dinner'
  dish_id: string
  dish?: Dish
}

export interface DailyLock {
  id: string
  household_id: string
  lock_date: string
  slot: 'lunch' | 'dinner'
  dish_id: string | null
  dish_name: string
  locked_by: string
  locked_by_username: string
  created_at: string
}

export type PantryTier = 'fresh' | 'weekly' | 'staple'
export type StockStatus = 'good' | 'low' | 'finished'

export interface PantryItem {
  id: string
  household_id: string
  name: string
  category: string
  tier: PantryTier
  stock_status: StockStatus
  depletion_days: number
  avg_depletion_days?: number | null
  order_count?: number
  last_ordered_at?: string
  created_at: string
}

export interface OrderItem {
  id: string
  household_id: string
  item_name: string
  added_by: string
  added_by_username?: string
  is_checked: boolean
  source: 'manual' | 'pantry' | 'meal_plan' | 'smart' | 'discover'
  status?: 'pending' | 'maybe' | 'ordered'
  created_at: string
}

export interface DishFeedback {
  id: string
  household_id: string
  user_id: string
  dish_id?: string | null
  dish_name?: string | null
  signal: 'like' | 'dislike'
  reason?: string | null
}

export interface AuthSession {
  user: User
  token: string
}
