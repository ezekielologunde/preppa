-- ============================================================================
-- Preppa — Messaging RPCs (additive, re-runnable)
--
-- 0001 created conversations / conversation_participants / messages with read
-- + send policies, but NO insert path for conversations (default-deny). This
-- migration adds a SECURITY DEFINER RPC to start (or reuse) a 1:1 conversation,
-- plus a helper to mark a conversation read. Sending messages already works via
-- the p_messages_send policy from 0001.
-- ============================================================================

set check_function_bodies = off;

-- Start a direct (1:1) conversation with another user, reusing an existing one
-- if the same two participants already share exactly one conversation.
create or replace function start_conversation(p_other uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_conv uuid;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_other is null or p_other = v_me then raise exception 'Invalid participant'; end if;

  -- Reuse an existing 1:1 conversation between exactly these two users.
  select cp.conversation_id into v_conv
  from conversation_participants cp
  join conversation_participants cp2 on cp2.conversation_id = cp.conversation_id
  where cp.user_id = v_me and cp2.user_id = p_other
  group by cp.conversation_id
  having count(*) = (select count(*) from conversation_participants x where x.conversation_id = cp.conversation_id)
     and count(*) = 2
  limit 1;

  if v_conv is not null then return v_conv; end if;

  insert into conversations default values returning id into v_conv;
  insert into conversation_participants (conversation_id, user_id) values (v_conv, v_me), (v_conv, p_other);
  return v_conv;
end $$;

-- Mark the caller's last-read pointer on a conversation.
create or replace function mark_conversation_read(p_conversation uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants
    set last_read_at = now()
    where conversation_id = p_conversation and user_id = auth.uid();
end $$;

grant execute on function start_conversation(uuid)      to authenticated;
grant execute on function mark_conversation_read(uuid)  to authenticated;
