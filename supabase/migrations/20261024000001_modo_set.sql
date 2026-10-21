-- L4: modo set. Cada plano guarda quantas vezes foi gravado e se já tem um take bom.
-- "recorded" (do L3) continua sendo "já gravei este plano".

alter table public.shots
    add column takes integer not null default 0 check (takes between 0 and 99),
    add column good_take boolean not null default false;
