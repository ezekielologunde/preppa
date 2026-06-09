-- ============================================================================
-- 0008 — Keep prepper_rating_summary in sync with reviews.
-- Additive + idempotent (create-or-replace / drop-if-exists). Safe to re-run.
--
-- 0001 ships the reviews table + the prepper_rating_summary read-model but no
-- writer, so submitted reviews never moved a prepper's rating. This recomputes
-- the summary whenever a review is inserted, edited, or removed.
-- ============================================================================

create or replace function recompute_prepper_rating(p_prepper uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  insert into prepper_rating_summary (prepper_id, average_rating, total_reviews, five_star, updated_at)
  select p_prepper,
         coalesce(round(avg(rating)::numeric, 2), 0),
         count(*),
         count(*) filter (where rating = 5),
         now()
    from reviews
   where prepper_id = p_prepper
  on conflict (prepper_id) do update set
    average_rating = excluded.average_rating,
    total_reviews  = excluded.total_reviews,
    five_star      = excluded.five_star,
    updated_at     = excluded.updated_at;
end $$;

create or replace function trg_review_rating()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recompute_prepper_rating(coalesce(new.prepper_id, old.prepper_id));
  return null;
end $$;

drop trigger if exists t_review_rating on reviews;
create trigger t_review_rating after insert or update or delete on reviews
  for each row execute function trg_review_rating();

-- Backfill any existing reviews into the summary (one row per rated prepper).
do $$
declare r record;
begin
  for r in select distinct prepper_id from reviews loop
    perform recompute_prepper_rating(r.prepper_id);
  end loop;
end $$;
