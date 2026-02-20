-- Enable PostGIS extension for geo-location
create extension if not exists postgis;

--------------------------------------------------------------------------------
-- 1. USERS & ROLES
--------------------------------------------------------------------------------

-- Create Custom Users Table
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password text not null,
  role text default 'citizen' check (role in ('citizen', 'admin', 'staff')),
  full_name text not null,
  phone text,
  address text,
  ward_number int,
  created_at timestamptz default now()
);

-- Disable RLS for hackathon simplicity
alter table public.users disable row level security;

--------------------------------------------------------------------------------
-- 2. DEPARTMENTS & STAFF
--------------------------------------------------------------------------------

-- Create Departments Table
create table if not exists public.departments (
  id uuid default gen_random_uuid() primary key,
  name text not null unique, -- Road, Garbage, Drainage, Lighting, Sanitation
  head_name text,
  contact_number text,
  email text,
  created_at timestamptz default now()
);

alter table public.departments disable row level security;

-- Create Staff Profiles (Linking users to departments)
create table if not exists public.staff_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade unique,
  department_id uuid references public.departments(id) on delete set null,
  employee_id text unique,
  designation text,
  is_available boolean default true,
  created_at timestamptz default now()
);

alter table public.staff_profiles disable row level security;

--------------------------------------------------------------------------------
-- 3. COMPLAINTS & MANAGEMENT
--------------------------------------------------------------------------------

-- Create Complaints Table
create table if not exists public.complaints (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  assigned_staff_id uuid references public.users(id) on delete set null,
  
  title text not null,
  description text not null,
  category text not null, -- Redundant with department_id but kept for quick AI filtering
  
  status text default 'open' check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'emergency')),
  
  location geography(point) not null,
  formatted_address text,
  
  sla_deadline timestamptz,
  escalation_level int default 0,
  
  rating smallint check (rating >= 1 and rating <= 5),
  feedback text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

alter table public.complaints disable row level security;

-- Create Complaint History (Audit Trail)
create table if not exists public.complaint_history (
  id uuid default gen_random_uuid() primary key,
  complaint_id uuid references public.complaints(id) on delete cascade,
  status_from text,
  status_to text,
  comment text,
  actor_id uuid references public.users(id), -- User or staff who made the change
  created_at timestamptz default now()
);

alter table public.complaint_history disable row level security;

-- Create Media Attachments
create table if not exists public.media_attachments (
  id uuid default gen_random_uuid() primary key,
  complaint_id uuid references public.complaints(id) on delete cascade,
  file_url text not null,
  file_type text check (file_type in ('image', 'audio', 'video')),
  created_at timestamptz default now()
);

alter table public.media_attachments disable row level security;

--------------------------------------------------------------------------------
-- 4. NOTIFICATIONS
--------------------------------------------------------------------------------

-- Create Notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean default false,
  link text, -- Path to navigate to in frontend
  created_at timestamptz default now()
);

alter table public.notifications disable row level security;

--------------------------------------------------------------------------------
-- 5. SEED DATA (CORE STRUCTURES)
--------------------------------------------------------------------------------

-- Insert default departments
insert into public.departments (name, contact_number) values
('Road Maintenance', '080-1234-5001'),
('Waste Management', '080-1234-5002'),
('Water & Sewage', '080-1234-5003'),
('Street Lighting', '080-1234-5004'),
('Public Health', '080-1234-5005')
on conflict (name) do nothing;

-- Enable Realtime for complaints
alter publication supabase_realtime add table public.complaints;
