-- Auth bootstrap: profile auto-creation + atomic company/owner setup.

-- Auto-create a `profiles` row whenever a new auth.users row is inserted.
-- security definer so it can write to `profiles` despite that table's RLS
-- only allowing self-select/self-update (no client-side insert policy).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically create a company and its owner membership. Exposed as an RPC
-- rather than opening an INSERT policy on `companies` to any authenticated
-- user, since a bare insert policy would let a signed-up-but-not-yet-member
-- user create companies with no ownership guarantee.
create or replace function public.create_company_with_owner(
  company_name text,
  company_currency text default 'INR'
)
returns companies
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company companies;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a company';
  end if;

  insert into companies (name, currency)
  values (company_name, company_currency)
  returning * into new_company;

  insert into company_members (company_id, user_id, role)
  values (new_company.id, auth.uid(), 'owner');

  return new_company;
end;
$$;

grant execute on function public.create_company_with_owner(text, text) to authenticated;
