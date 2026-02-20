-- Enable PostGIS extension for geo-location
create extension if not exists postgis;

-- Create Custom Users Table (Replacing Supabase Auth)
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password text not null, -- Manual password management
  role text default 'citizen' check (role in ('citizen', 'admin')),
  full_name text,
  created_at timestamptz default now()
);

-- Note: RLS is disabled by default for this custom table to allow the frontend 
-- to query it manually for Login/Signup without needing a logged-in Supabase Auth session.
alter table public.users disable row level security;

-- Create Complaints Table
create table if not exists public.complaints (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete set null, -- Points to our custom table
  title text not null,
  description text not null,
  category text not null, -- Road, Garbage, Drainage, Lighting, Sanitation
  department text,
  status text default 'open',
  priority text default 'medium',
  location geography(point) not null,
  sla_deadline timestamptz not null,
  rating smallint check (rating >= 1 and rating <= 5),
  feedback text,
  escalation_level int default 0,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Disable RLS for hackathon simplicity (or implement manual checks)
alter table public.complaints disable row level security;
