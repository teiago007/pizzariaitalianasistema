-- 1) Drink sizes table
create table if not exists public.drink_sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order integer not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drink_sizes_name_unique unique (name)
);

alter table public.drink_sizes enable row level security;

create policy "Anyone can view drink sizes"
on public.drink_sizes
for select
using (true);

create policy "Admins can manage drink sizes"
on public.drink_sizes
for all
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists idx_drink_sizes_available_order
on public.drink_sizes (available, display_order, name);

-- 2) Add relation to products
alter table public.products
add column if not exists drink_size_id uuid null;

alter table public.products
add constraint products_drink_size_id_fkey
foreign key (drink_size_id)
references public.drink_sizes(id)
on delete set null;

create index if not exists idx_products_drink_size_id
on public.products (drink_size_id);

-- 3) updated_at trigger for drink_sizes
-- Reuse existing function public.update_updated_at_column()
drop trigger if exists update_drink_sizes_updated_at on public.drink_sizes;
create trigger update_drink_sizes_updated_at
before update on public.drink_sizes
for each row
execute function public.update_updated_at_column();
