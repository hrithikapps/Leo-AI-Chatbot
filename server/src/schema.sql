create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  application_id   text not null,
  external_user_id text null,
  created_at       timestamptz not null default now()
);

create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id),
  role             text not null check (role in ('user','assistant','system')),
  content          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on messages (conversation_id);

create table if not exists faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  category   text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tickets (
  id                uuid primary key default gen_random_uuid(),
  application_id    text not null,
  external_user_id  text null,
  subject           text not null,
  description       text not null,
  status            text not null default 'open' check (status in ('open','closed')),
  created_at        timestamptz not null default now()
);

alter table tickets add column if not exists tier text null check (tier in ('L1','L2','L3'));
alter table tickets add column if not exists assignee text null;

alter table tickets drop constraint if exists tickets_status_check;
alter table tickets add constraint tickets_status_check check (status in ('open','in_progress','closed'));

alter table tickets add column if not exists resolved_at timestamptz null;
alter table tickets add column if not exists sla_breach_notified boolean not null default false;
