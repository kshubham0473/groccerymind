-- GroceryMind Database Schema
-- Run this entire file in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Households
create table households (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  member_count int default 2,
  created_at timestamptz default now()
);

-- Users
create table users (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  username text unique not null,
  password_hash text not null,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now()
);

-- Dishes
create table dishes (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  cuisine_type text,
  protein_type text,
  ingredients text[] default '{}',
  created_at timestamptz default now()
);

-- Meal Plan Slots
create table meal_slots (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  day text not null check (day in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  slot text not null check (slot in ('lunch','dinner')),
  dish_id uuid references dishes(id) on delete cascade,
  created_at timestamptz default now()
);

-- Pantry Items
create table pantry_items (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  category text not null default 'General',
  tier text not null default 'fresh' check (tier in ('fresh','weekly','staple')),
  stock_status text not null default 'good' check (stock_status in ('good','low','finished')),
  depletion_days int default 7,
  last_ordered_at timestamptz,
  created_at timestamptz default now()
);

-- Order List
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  item_name text not null,
  added_by uuid references users(id),
  is_checked boolean default false,
  source text default 'manual' check (source in ('manual','pantry','meal_plan','smart')),
  created_at timestamptz default now()
);

-- Behaviour Log
create table behaviour_log (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  user_id uuid references users(id),
  event_type text not null,
  item_ref uuid,
  dish_ref uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Dish Feedback
create table dish_feedback (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  user_id uuid references users(id),
  dish_id uuid references dishes(id) on delete cascade,
  signal text check (signal in ('like','dislike')),
  reason text,
  created_at timestamptz default now()
);

-- Enable Realtime for order_items and pantry_items
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table pantry_items;

-- Row Level Security (disabled for now, using service role on backend)
-- You can enable RLS later for extra security

-- Seed: Create a demo household and admin user
-- Password is: admin123 (bcrypt hash)
-- CHANGE THIS after first login!
insert into households (id, name, member_count) values
  ('00000000-0000-0000-0000-000000000001', 'My Home', 2);

insert into users (household_id, username, password_hash, role) values
  ('00000000-0000-0000-0000-000000000001', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
-- Default password: 'password' — CHANGE IMMEDIATELY after first login

-- Seed: Your meal plan from the screenshot
-- First insert all dishes
insert into dishes (id, household_id, name, cuisine_type, protein_type, ingredients) values
  ('d0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Dal Chawal', 'Indian', 'lentil', ARRAY['dal', 'rice', 'onion', 'tomato', 'cumin', 'turmeric', 'ghee']),
  ('d0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Kadi Chawal', 'Indian', 'dairy', ARRAY['curd', 'besan', 'rice', 'onion', 'mustard seeds', 'curry leaves', 'ghee']),
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Suji Chilla', 'Indian', 'grain', ARRAY['suji', 'onion', 'tomato', 'green chilli', 'coriander', 'oil']),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Moong Dal Cheela', 'Indian', 'lentil', ARRAY['moong dal', 'onion', 'green chilli', 'ginger', 'coriander', 'oil']),
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Besan Cheela', 'Indian', 'grain', ARRAY['besan', 'onion', 'tomato', 'green chilli', 'coriander', 'oil']),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Palak Paneer', 'Indian', 'dairy', ARRAY['palak', 'paneer', 'onion', 'tomato', 'cream', 'garam masala', 'oil']),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Paneer ki Sabzi', 'Indian', 'dairy', ARRAY['paneer', 'onion', 'tomato', 'capsicum', 'garam masala', 'oil']),
  ('d0000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Gobi Paratha', 'Indian', 'vegetable', ARRAY['cauliflower', 'wheat flour', 'onion', 'green chilli', 'coriander', 'butter']),
  ('d0000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Paneer Paratha', 'Indian', 'dairy', ARRAY['paneer', 'wheat flour', 'onion', 'green chilli', 'coriander', 'butter']),
  ('d0000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Aloo Paratha', 'Indian', 'vegetable', ARRAY['potato', 'wheat flour', 'onion', 'green chilli', 'coriander', 'butter']),
  ('d0000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Aloo Tikki Roll', 'Indian', 'vegetable', ARRAY['potato', 'wheat flour', 'onion', 'coriander chutney', 'tamarind chutney', 'oil']),
  ('d0000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Chole Chawal', 'Indian', 'legume', ARRAY['chole', 'rice', 'onion', 'tomato', 'ginger', 'garlic', 'oil']),
  ('d0000001-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Rajama Chawal', 'Indian', 'legume', ARRAY['rajma', 'rice', 'onion', 'tomato', 'ginger', 'garlic', 'oil']),
  ('d0000001-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Macaroni', 'Western', 'grain', ARRAY['macaroni', 'onion', 'tomato', 'capsicum', 'pasta sauce', 'cheese']),
  ('d0000001-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Black Channa Chat', 'Indian', 'legume', ARRAY['black channa', 'onion', 'tomato', 'green chilli', 'tamarind chutney', 'sev']),
  ('d0000001-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Shimla Mirch Sabzi', 'Indian', 'vegetable', ARRAY['capsicum', 'onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'Aloo Methi', 'Indian', 'vegetable', ARRAY['potato', 'methi', 'onion', 'oil', 'cumin']),
  ('d0000001-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'Anda Curry', 'Indian', 'egg', ARRAY['eggs', 'onion', 'tomato', 'ginger', 'garlic', 'oil']),
  ('d0000001-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'Bread Roll', 'Indian', 'grain', ARRAY['bread', 'potato', 'onion', 'green chilli', 'coriander', 'oil']),
  ('d0000001-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Sandwich Curd Walli', 'Indian', 'dairy', ARRAY['bread', 'curd', 'cucumber', 'tomato', 'onion', 'chaat masala']),
  ('d0000001-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Bhindi Sabzi', 'Indian', 'vegetable', ARRAY['bhindi', 'onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'Toorai Sabzi', 'Indian', 'vegetable', ARRAY['toorai', 'onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'Tinde Sabzi', 'Indian', 'vegetable', ARRAY['tinde', 'onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 'Arabi Sabzi', 'Indian', 'vegetable', ARRAY['arabi', 'onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', 'Baingan Sabzi', 'Indian', 'vegetable', ARRAY['baingan', 'onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', 'Tawa Pulao', 'Indian', 'grain', ARRAY['rice', 'onion', 'tomato', 'capsicum', 'pav bhaji masala', 'butter']),
  ('d0000001-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', 'Pav Bhaji', 'Indian', 'vegetable', ARRAY['pav', 'potato', 'onion', 'tomato', 'capsicum', 'pav bhaji masala', 'butter']),
  ('d0000001-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000001', 'Poha', 'Indian', 'grain', ARRAY['poha', 'onion', 'potato', 'mustard seeds', 'curry leaves', 'oil']),
  ('d0000001-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000001', 'Vermicelli Upma', 'Indian', 'grain', ARRAY['vermicelli', 'onion', 'tomato', 'mustard seeds', 'curry leaves', 'oil']),
  ('d0000001-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'Upma', 'Indian', 'grain', ARRAY['suji', 'onion', 'tomato', 'mustard seeds', 'curry leaves', 'oil']),
  ('d0000001-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'Egg Kheema', 'Indian', 'egg', ARRAY['eggs', 'onion', 'tomato', 'ginger', 'garlic', 'oil']),
  ('d0000001-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', 'Misal', 'Indian', 'legume', ARRAY['sprouted moth beans', 'onion', 'tomato', 'sev', 'pav', 'oil']),
  ('d0000001-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', 'Sandwich', 'Indian', 'grain', ARRAY['bread', 'cucumber', 'tomato', 'onion', 'butter', 'chutney']),
  ('d0000001-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', 'Pyaaz Walli Sabzi', 'Indian', 'vegetable', ARRAY['onion', 'tomato', 'oil', 'coriander']),
  ('d0000001-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001', 'Kofta Curry', 'Indian', 'vegetable', ARRAY['potato', 'paneer', 'onion', 'tomato', 'cream', 'oil']);

-- Meal slots
insert into meal_slots (household_id, day, slot, dish_id) values
  -- Monday
  ('00000000-0000-0000-0000-000000000001', 'monday', 'lunch', 'd0000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', 'monday', 'lunch', 'd0000001-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', 'monday', 'dinner', 'd0000001-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'monday', 'dinner', 'd0000001-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000001', 'monday', 'dinner', 'd0000001-0000-0000-0000-000000000005'),
  -- Tuesday
  ('00000000-0000-0000-0000-000000000001', 'tuesday', 'lunch', 'd0000001-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-000000000001', 'tuesday', 'lunch', 'd0000001-0000-0000-0000-000000000007'),
  ('00000000-0000-0000-0000-000000000001', 'tuesday', 'dinner', 'd0000001-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000001', 'tuesday', 'dinner', 'd0000001-0000-0000-0000-000000000009'),
  ('00000000-0000-0000-0000-000000000001', 'tuesday', 'dinner', 'd0000001-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000001', 'tuesday', 'dinner', 'd0000001-0000-0000-0000-000000000011'),
  -- Wednesday
  ('00000000-0000-0000-0000-000000000001', 'wednesday', 'lunch', 'd0000001-0000-0000-0000-000000000012'),
  ('00000000-0000-0000-0000-000000000001', 'wednesday', 'lunch', 'd0000001-0000-0000-0000-000000000013'),
  ('00000000-0000-0000-0000-000000000001', 'wednesday', 'dinner', 'd0000001-0000-0000-0000-000000000014'),
  ('00000000-0000-0000-0000-000000000001', 'wednesday', 'dinner', 'd0000001-0000-0000-0000-000000000015'),
  -- Thursday
  ('00000000-0000-0000-0000-000000000001', 'thursday', 'lunch', 'd0000001-0000-0000-0000-000000000016'),
  ('00000000-0000-0000-0000-000000000001', 'thursday', 'lunch', 'd0000001-0000-0000-0000-000000000017'),
  ('00000000-0000-0000-0000-000000000001', 'thursday', 'lunch', 'd0000001-0000-0000-0000-000000000018'),
  ('00000000-0000-0000-0000-000000000001', 'thursday', 'dinner', 'd0000001-0000-0000-0000-000000000019'),
  ('00000000-0000-0000-0000-000000000001', 'thursday', 'dinner', 'd0000001-0000-0000-0000-000000000020'),
  ('00000000-0000-0000-0000-000000000001', 'thursday', 'dinner', 'd0000001-0000-0000-0000-000000000011'),
  -- Friday
  ('00000000-0000-0000-0000-000000000001', 'friday', 'lunch', 'd0000001-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000001', 'friday', 'lunch', 'd0000001-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000001', 'friday', 'lunch', 'd0000001-0000-0000-0000-000000000023'),
  ('00000000-0000-0000-0000-000000000001', 'friday', 'lunch', 'd0000001-0000-0000-0000-000000000024'),
  ('00000000-0000-0000-0000-000000000001', 'friday', 'lunch', 'd0000001-0000-0000-0000-000000000025'),
  ('00000000-0000-0000-0000-000000000001', 'friday', 'dinner', 'd0000001-0000-0000-0000-000000000026'),
  ('00000000-0000-0000-0000-000000000001', 'friday', 'dinner', 'd0000001-0000-0000-0000-000000000027'),
  -- Saturday
  ('00000000-0000-0000-0000-000000000001', 'saturday', 'lunch', 'd0000001-0000-0000-0000-000000000028'),
  ('00000000-0000-0000-0000-000000000001', 'saturday', 'lunch', 'd0000001-0000-0000-0000-000000000029'),
  ('00000000-0000-0000-0000-000000000001', 'saturday', 'lunch', 'd0000001-0000-0000-0000-000000000030'),
  ('00000000-0000-0000-0000-000000000001', 'saturday', 'lunch', 'd0000001-0000-0000-0000-000000000031'),
  ('00000000-0000-0000-0000-000000000001', 'saturday', 'dinner', 'd0000001-0000-0000-0000-000000000032'),
  ('00000000-0000-0000-0000-000000000001', 'saturday', 'dinner', 'd0000001-0000-0000-0000-000000000033'),
  -- Sunday
  ('00000000-0000-0000-0000-000000000001', 'sunday', 'lunch', 'd0000001-0000-0000-0000-000000000028'),
  ('00000000-0000-0000-0000-000000000001', 'sunday', 'lunch', 'd0000001-0000-0000-0000-000000000029'),
  ('00000000-0000-0000-0000-000000000001', 'sunday', 'lunch', 'd0000001-0000-0000-0000-000000000030'),
  ('00000000-0000-0000-0000-000000000001', 'sunday', 'dinner', 'd0000001-0000-0000-0000-000000000034'),
  ('00000000-0000-0000-0000-000000000001', 'sunday', 'dinner', 'd0000001-0000-0000-0000-000000000035');

-- Seed pantry with common items from the meal plan
insert into pantry_items (household_id, name, category, tier, stock_status, depletion_days) values
  -- Fresh daily
  ('00000000-0000-0000-0000-000000000001', 'Onion', 'Vegetables', 'fresh', 'good', 4),
  ('00000000-0000-0000-0000-000000000001', 'Tomato', 'Vegetables', 'fresh', 'good', 4),
  ('00000000-0000-0000-0000-000000000001', 'Potato', 'Vegetables', 'fresh', 'good', 7),
  ('00000000-0000-0000-0000-000000000001', 'Paneer', 'Dairy', 'fresh', 'good', 3),
  ('00000000-0000-0000-0000-000000000001', 'Curd', 'Dairy', 'fresh', 'good', 4),
  ('00000000-0000-0000-0000-000000000001', 'Palak', 'Vegetables', 'fresh', 'good', 3),
  ('00000000-0000-0000-0000-000000000001', 'Bhindi', 'Vegetables', 'fresh', 'good', 4),
  ('00000000-0000-0000-0000-000000000001', 'Capsicum', 'Vegetables', 'fresh', 'good', 5),
  ('00000000-0000-0000-0000-000000000001', 'Cauliflower', 'Vegetables', 'fresh', 'good', 5),
  ('00000000-0000-0000-0000-000000000001', 'Banana', 'Fruits', 'fresh', 'good', 4),
  ('00000000-0000-0000-0000-000000000001', 'Eggs', 'Dairy', 'fresh', 'good', 7),
  ('00000000-0000-0000-0000-000000000001', 'Bread', 'Bakery', 'fresh', 'good', 5),
  -- Weekly
  ('00000000-0000-0000-0000-000000000001', 'Milk Packets', 'Dairy', 'weekly', 'good', 7),
  ('00000000-0000-0000-0000-000000000001', 'Butter', 'Dairy', 'weekly', 'good', 14),
  ('00000000-0000-0000-0000-000000000001', 'Pav', 'Bakery', 'weekly', 'good', 5),
  ('00000000-0000-0000-0000-000000000001', 'Poha', 'Breakfast', 'weekly', 'good', 14),
  ('00000000-0000-0000-0000-000000000001', 'Vermicelli', 'Breakfast', 'weekly', 'good', 21),
  ('00000000-0000-0000-0000-000000000001', 'Hot Sauce', 'Condiments', 'weekly', 'good', 21),
  ('00000000-0000-0000-0000-000000000001', 'Pasta Sauce', 'Condiments', 'weekly', 'good', 21),
  -- Staples
  ('00000000-0000-0000-0000-000000000001', 'Rajma', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Chole', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Dal', 'Grains & Lentils', 'staple', 'good', 21),
  ('00000000-0000-0000-0000-000000000001', 'Rice', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Wheat Flour', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Besan', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Suji', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Macaroni', 'Packaged', 'staple', 'good', 45),
  ('00000000-0000-0000-0000-000000000001', 'Sev', 'Packaged', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Moong Dal', 'Grains & Lentils', 'staple', 'good', 30),
  ('00000000-0000-0000-0000-000000000001', 'Black Channa', 'Grains & Lentils', 'staple', 'good', 30);
