-- RB1 Roll · banco Supabase (projeto rb1-roll, região sa-east-1).
-- Recria o banco do zero: tabelas, leitura pública e funções de gravação com validação.
-- Leitura pública (painel sem login); nenhuma gravação direta: tudo passa pelas funções abaixo.

create table public.rolls(
  id int primary key, name text not null, location text not null, serial text,
  diameter numeric, perimeter numeric, installed timestamptz, version int not null default 0);
create table public.events(
  id text primary key default gen_random_uuid()::text, roll_id int not null references public.rolls(id),
  operator text not null, shift text not null, occurred timestamptz not null, recorded timestamptz not null default now(),
  reason text not null, serial text not null default '', old_serial text, diameter numeric, notes text not null default '',
  perimeter numeric, source text, removed_dest text);  -- source: estoque de origem do rolo novo; removed_dest: destino do rolo retirado
create index events_occurred_idx on public.events(occurred desc);
create index events_roll_idx on public.events(roll_id);
create table public.stock_slots(
  place text not null check (place in ('retifica','rb1')), slot int not null check (slot between 1 and 4),
  code text, perimeter numeric, diameter numeric, condition text, entered timestamptz, operator text, notes text,
  version int not null default 0, primary key(place,slot));
create table public.stock_log(
  id text primary key default gen_random_uuid()::text, place text not null, slot int not null,
  action text not null check (action in ('entrada','saida')), code text, perimeter numeric, diameter numeric,
  condition text, destination text, operator text not null, shift text not null, occurred timestamptz not null,
  recorded timestamptz not null default now(), notes text,
  foreign key(place,slot) references public.stock_slots(place,slot));
create index stock_log_occurred_idx on public.stock_log(occurred desc);
create index stock_log_slot_idx on public.stock_log(place,slot);

insert into public.rolls(id,name,location) select i, 'Rolo '||i, case when i=0 then 'Externo · entrada' else 'Forno · posição '||i end from generate_series(0,4) i;
insert into public.stock_slots(place,slot) select p, s from unnest(array['retifica','rb1']) p, generate_series(1,4) s;

alter table public.rolls enable row level security;
alter table public.events enable row level security;
alter table public.stock_slots enable row level security;
alter table public.stock_log enable row level security;
create policy "leitura pública" on public.rolls for select to anon, authenticated using (true);
create policy "leitura pública" on public.events for select to anon, authenticated using (true);
create policy "leitura pública" on public.stock_slots for select to anon, authenticated using (true);
create policy "leitura pública" on public.stock_log for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.rolls, public.events, public.stock_slots, public.stock_log from anon, authenticated;

-- Auxiliares de validação (não expostas ao público).
create function public.rb1_text(p jsonb, k text, maxlen int, label text) returns text language plpgsql immutable set search_path='' as $$
declare v text := btrim(coalesce(p->>k,''));
begin
  if v = '' or length(v) > maxlen then raise exception 'Preencha corretamente: %.', label; end if;
  return v;
end $$;
create function public.rb1_when(p jsonb) returns timestamptz language plpgsql stable set search_path='' as $$
declare t timestamptz;
begin
  begin t := (p->>'occurred')::timestamptz; exception when others then raise exception 'Data inválida.'; end;
  if t is null then raise exception 'Data inválida.'; end if;
  if t > now() + interval '2 minutes' then raise exception 'Não é permitido registrar uma data futura.'; end if;
  return t;
end $$;
create function public.rb1_shift(t timestamptz) returns text language sql immutable set search_path='' as $$
  select case when extract(hour from t at time zone 'America/Sao_Paulo') >= 23 or extract(hour from t at time zone 'America/Sao_Paulo') < 7 then 'TN'
              when extract(hour from t at time zone 'America/Sao_Paulo') < 15 then 'TM' else 'TT' end $$;
create function public.rb1_measure(p jsonb, k text, lim numeric, label text, optional boolean) returns numeric language plpgsql immutable set search_path='' as $$
declare v numeric;
begin
  if p->k is null or jsonb_typeof(p->k) = 'null' then
    if optional then return null; end if;
    raise exception '% inválido.', label;
  end if;
  if jsonb_typeof(p->k) <> 'number' then raise exception '% inválido.', label; end if;
  v := (p->>k)::numeric;
  if v <= 0 or v >= lim then raise exception '% inválido.', label; end if;
  return v;
end $$;

-- Troca de rolo do forno: o rolo novo sai de uma bandeja de estoque (somente pronto para uso)
-- na mesma transação, ou é informado manualmente ("Fora do estoque").
create function public.register_replacement(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rolls; s public.stock_slots; v_op text := public.rb1_text(p,'operator',100,'operador'); v_t timestamptz := public.rb1_when(p);
        v_reason text := public.rb1_text(p,'reason',200,'motivo'); v_d numeric; v_per numeric; v_code text; v_src text; v_dest text;
        v_notes text := left(coalesce(p->>'notes',''),2000);
begin
  select * into r from public.rolls where id = (p->>'roll_id')::int for update;
  if not found then raise exception 'Posição inválida.'; end if;
  if (p->>'version')::int is distinct from r.version then raise exception 'Este rolo foi atualizado. Recarregue antes de registrar.'; end if;
  if r.installed is not null and v_t <= r.installed then raise exception 'A troca deve ser posterior à última instalação.'; end if;
  v_dest := nullif(left(btrim(coalesce(p->>'removed_dest','')),200),'');
  if jsonb_typeof(p->'stock') = 'object' then
    if coalesce(p->'stock'->>'place','') not in ('retifica','rb1') then raise exception 'Estoque inválido.'; end if;
    select * into s from public.stock_slots where place=p->'stock'->>'place' and slot=(p->'stock'->>'slot')::int for update;
    if not found then raise exception 'Posição do estoque inválida.'; end if;
    if (p->'stock'->>'version')::int is distinct from s.version then raise exception 'O estoque foi atualizado por outro registro. Atualize a tela.'; end if;
    if s.entered is null then raise exception 'Não há rolo nesta posição do estoque.'; end if;
    if s.condition is distinct from 'Retificado · pronto para uso' then raise exception 'Este rolo do estoque não está pronto para uso.'; end if;
    if v_t < s.entered then raise exception 'A troca deve ser posterior à entrada do rolo no estoque.'; end if;
    v_code := s.code; v_per := s.perimeter; v_d := s.diameter;
    v_src := case s.place when 'rb1' then 'Estoque RB1' else 'Estoque da retífica' end || ' · posição ' || s.slot;
    update public.stock_slots set code=null, perimeter=null, diameter=null, condition=null, entered=null, operator=null, notes=null, version=version+1
      where place=s.place and slot=s.slot;
    insert into public.stock_log(place,slot,action,code,perimeter,diameter,condition,destination,operator,shift,occurred,notes)
      values(s.place,s.slot,'saida',s.code,s.perimeter,s.diameter,s.condition,'Instalado no forno · '||r.name||' ('||r.location||')',v_op,public.rb1_shift(v_t),v_t,'Saída automática pela troca do rolo');
  else
    v_code := nullif(left(btrim(coalesce(p->>'serial','')),100),'');
    v_d := public.rb1_measure(p,'diameter',10000,'Diâmetro',true);
    v_per := public.rb1_measure(p,'perimeter',20000,'Perímetro',true);
    v_src := 'Fora do estoque';
  end if;
  insert into public.events(roll_id,operator,shift,occurred,reason,serial,old_serial,diameter,perimeter,source,removed_dest,notes)
    values(r.id,v_op,public.rb1_shift(v_t),v_t,v_reason,coalesce(v_code,''),r.serial,v_d,v_per,v_src,v_dest,v_notes);
  update public.rolls set installed=v_t, serial=v_code, diameter=v_d, perimeter=v_per, version=version+1 where id=r.id;
  return jsonb_build_object('ok',true);
end $$;

-- Senha de 4 dígitos para lançar rolos no estoque da retífica: guardada só como hash bcrypt,
-- num schema que a API não expõe. Após 5 erros em 15 minutos, novas tentativas ficam bloqueadas.
-- Troque 0000 pela senha desejada (não grave a senha real neste arquivo). Para trocar depois:
--   update private.settings set value = extensions.crypt('NOVA', extensions.gen_salt('bf', 10)) where key = 'retifica_pin';
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.settings(key text primary key, value text not null);
create table private.pin_attempts(at timestamptz not null default now());
insert into private.settings values('retifica_pin', extensions.crypt('0000', extensions.gen_salt('bf', 10)));

-- Entrada e saída dos estoques (retífica e RB1). Entrada na retífica exige a senha.
create function public.stock_move(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.stock_slots; v_op text; v_t timestamptz;
        v_act text := p->>'action'; v_notes text := left(btrim(coalesce(p->>'notes','')),2000);
        v_code text; v_per numeric; v_d numeric; v_cond text; v_dest text; v_hash text;
begin
  -- Erros de senha ficam registrados (por isso retorna {ok:false} em vez de lançar exceção).
  if p->>'place' = 'retifica' and v_act = 'entrada' then
    delete from private.pin_attempts where at < now() - interval '1 day';
    if (select count(*) from private.pin_attempts where at > now() - interval '15 minutes') >= 5 then
      return jsonb_build_object('ok',false,'error','Muitas tentativas com senha errada. Aguarde 15 minutos.');
    end if;
    select value into v_hash from private.settings where key='retifica_pin';
    if coalesce(p->>'pin','') !~ '^\d{4}$' or extensions.crypt(p->>'pin', v_hash) <> v_hash then
      insert into private.pin_attempts default values;
      return jsonb_build_object('ok',false,'error','Senha da retífica incorreta.');
    end if;
    -- O Supabase recusa DELETE sem WHERE vindo da API (safeupdate).
    delete from private.pin_attempts where at is not null;
  end if;
  v_op := public.rb1_text(p,'operator',100,'operador'); v_t := public.rb1_when(p);
  if coalesce(p->>'place','') not in ('retifica','rb1') then raise exception 'Estoque inválido.'; end if;
  select * into s from public.stock_slots where place=p->>'place' and slot=(p->>'slot')::int for update;
  if not found then raise exception 'Posição da bandeja inválida.'; end if;
  if (p->>'version')::int is distinct from s.version then raise exception 'A bandeja foi atualizada por outro registro. Atualize a tela.'; end if;
  if v_act = 'entrada' then
    if s.entered is not null then raise exception 'Esta posição da bandeja já está ocupada.'; end if;
    v_code := nullif(left(btrim(coalesce(p->>'code','')),60),'');
    v_per := public.rb1_measure(p,'perimeter',20000,'Perímetro',false);
    v_d := public.rb1_measure(p,'diameter',10000,'Diâmetro',true);
    v_cond := p->>'condition';
    if v_cond is null or v_cond not in ('Retificado · pronto para uso','Aguardando retífica','Em inspeção') then raise exception 'Selecione a condição do rolo.'; end if;
    update public.stock_slots set code=v_code, perimeter=v_per, diameter=v_d, condition=v_cond, entered=v_t, operator=v_op, notes=v_notes, version=version+1
      where place=s.place and slot=s.slot;
    insert into public.stock_log(place,slot,action,code,perimeter,diameter,condition,operator,shift,occurred,notes)
      values(s.place,s.slot,'entrada',v_code,v_per,v_d,v_cond,v_op,public.rb1_shift(v_t),v_t,v_notes);
  elsif v_act = 'saida' then
    if s.entered is null then raise exception 'Esta posição da bandeja está vazia.'; end if;
    if v_t < s.entered then raise exception 'A saída deve ser posterior à entrada do rolo.'; end if;
    v_dest := public.rb1_text(p,'destination',200,'destino');
    -- Transferência retífica → RB1: o rolo entra na posição livre escolhida, com os mesmos dados.
    if s.place = 'retifica' and v_dest = 'Transferido para o estoque RB1' then
      declare t public.stock_slots;
      begin
        select * into t from public.stock_slots where place='rb1' and slot=(p->>'transfer_slot')::int for update;
        if not found then raise exception 'Escolha a posição livre no estoque RB1.'; end if;
        if (p->>'transfer_version')::int is distinct from t.version then raise exception 'O estoque RB1 foi atualizado por outro registro. Atualize a tela.'; end if;
        if t.entered is not null then raise exception 'A posição escolhida no estoque RB1 já está ocupada.'; end if;
        update public.stock_slots set code=s.code, perimeter=s.perimeter, diameter=s.diameter, condition=s.condition, entered=v_t, operator=v_op,
          notes='Transferido da retífica · posição '||s.slot, version=version+1 where place='rb1' and slot=t.slot;
        insert into public.stock_log(place,slot,action,code,perimeter,diameter,condition,operator,shift,occurred,notes)
          values('rb1',t.slot,'entrada',s.code,s.perimeter,s.diameter,s.condition,v_op,public.rb1_shift(v_t),v_t,'Transferido da retífica · posição '||s.slot);
        v_dest := 'Transferido para o estoque RB1 · posição '||t.slot;
      end;
    end if;
    update public.stock_slots set code=null, perimeter=null, diameter=null, condition=null, entered=null, operator=null, notes=null, version=version+1
      where place=s.place and slot=s.slot;
    insert into public.stock_log(place,slot,action,code,perimeter,diameter,condition,destination,operator,shift,occurred,notes)
      values(s.place,s.slot,'saida',s.code,s.perimeter,s.diameter,s.condition,v_dest,v_op,public.rb1_shift(v_t),v_t,v_notes);
  else raise exception 'Operação inválida.'; end if;
  return jsonb_build_object('ok',true);
end $$;

-- Importação dos registros do modo local (navegador): só acrescenta, nunca sobrescreve.
-- Não ocupa a bandeja da retífica (ela exige a senha no lançamento).
create function public.import_local(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; x jsonb; n_events int := 0; n_moves int := 0; n_rolls int := 0; n_slots int := 0; k int;
begin
  if jsonb_typeof(p->'events') is distinct from 'array' then raise exception 'Dados inválidos.'; end if;
  if jsonb_array_length(p->'events') > 5000 or jsonb_array_length(coalesce(p->'stock_moves','[]')) > 5000 then raise exception 'Volume de dados acima do limite de importação.'; end if;
  for e in select * from jsonb_array_elements(p->'events') loop
    if (e->>'roll_id')::int between 0 and 4 and coalesce(btrim(e->>'operator'),'') <> '' then
      insert into public.events(id,roll_id,operator,shift,occurred,reason,serial,old_serial,diameter,notes)
      values(left(e->>'id',64),(e->>'roll_id')::int,left(e->>'operator',100),public.rb1_shift((e->>'occurred')::timestamptz),(e->>'occurred')::timestamptz,
             left(coalesce(e->>'reason','Importado'),200),left(coalesce(e->>'serial',''),100),left(e->>'old_serial',100),
             case when jsonb_typeof(e->'diameter')='number' and (e->>'diameter')::numeric > 0 and (e->>'diameter')::numeric < 10000 then (e->>'diameter')::numeric end,
             left(coalesce(e->>'notes',''),2000))
      on conflict (id) do nothing;
      get diagnostics k = row_count; n_events := n_events + k;
    end if;
  end loop;
  -- Cada rolo assume a troca mais recente entre banco e navegador.
  for x in select * from jsonb_array_elements(coalesce(p->'rolls','[]')) loop
    if x->>'installed' is not null then
      update public.rolls set installed=(x->>'installed')::timestamptz, serial=left(x->>'serial',100),
        diameter=case when jsonb_typeof(x->'diameter')='number' then (x->>'diameter')::numeric end, version=version+1
      where id=(x->>'id')::int and (installed is null or installed < (x->>'installed')::timestamptz);
      get diagnostics k = row_count; n_rolls := n_rolls + k;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'stock','[]')) loop
    if x->>'entered' is not null and jsonb_typeof(x->'perimeter')='number' then
      update public.stock_slots set code=left(x->>'code',60), perimeter=(x->>'perimeter')::numeric,
        diameter=case when jsonb_typeof(x->'diameter')='number' then (x->>'diameter')::numeric end,
        condition=left(x->>'condition',60), entered=(x->>'entered')::timestamptz, operator=left(x->>'operator',100), notes=left(x->>'notes',2000), version=version+1
      where place=coalesce(x->>'place','retifica') and place <> 'retifica' and slot=(x->>'slot')::int and entered is null;
      get diagnostics k = row_count; n_slots := n_slots + k;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'stock_moves','[]')) loop
    if coalesce(x->>'place','retifica') in ('retifica','rb1') and (x->>'slot')::int between 1 and 4 and x->>'action' in ('entrada','saida') then
      insert into public.stock_log(id,place,slot,action,code,perimeter,diameter,condition,destination,operator,shift,occurred,notes)
      values(left(x->>'id',64),coalesce(x->>'place','retifica'),(x->>'slot')::int,x->>'action',left(x->>'code',60),
             case when jsonb_typeof(x->'perimeter')='number' then (x->>'perimeter')::numeric end,
             case when jsonb_typeof(x->'diameter')='number' then (x->>'diameter')::numeric end,
             left(x->>'condition',60),left(x->>'destination',200),left(coalesce(x->>'operator','Importado'),100),
             public.rb1_shift((x->>'occurred')::timestamptz),(x->>'occurred')::timestamptz,left(x->>'notes',2000))
      on conflict (id) do nothing;
      get diagnostics k = row_count; n_moves := n_moves + k;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'events',n_events,'rolls',n_rolls,'stock',n_slots,'moves',n_moves);
end $$;

revoke all on function public.register_replacement(jsonb), public.stock_move(jsonb), public.import_local(jsonb) from public;
grant execute on function public.register_replacement(jsonb), public.stock_move(jsonb), public.import_local(jsonb) to anon, authenticated;
revoke all on function public.rb1_text(jsonb,text,int,text), public.rb1_when(jsonb), public.rb1_shift(timestamptz), public.rb1_measure(jsonb,text,numeric,text,boolean) from public, anon, authenticated;
