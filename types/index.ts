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
  dislikes?: string
  cuisine_prefs?: string[]
  dietary?: string
  quickcommerce?: ('blinkit' | 'zepto' | 'swiggy' | 'bigbasket')[]
  member_names?: Record<string, string>
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
  lock_date: string        // YYYY-MM-DD
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
