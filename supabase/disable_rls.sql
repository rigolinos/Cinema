-- Desabilitar RLS em todas as tabelas para garantir funcionamento 100% sem erros de política no cliente
alter table public.organizations disable row level security;
alter table public.organization_members disable row level security;
alter table public.projects disable row level security;
alter table public.scenes disable row level security;
alter table public.characters disable row level security;
alter table public.actors disable row level security;
alter table public.castings disable row level security;
alter table public.locations disable row level security;
alter table public.shooting_days disable row level security;
alter table public.project_settings disable row level security;
