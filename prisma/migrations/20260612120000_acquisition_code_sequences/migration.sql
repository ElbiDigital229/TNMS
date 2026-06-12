-- Concurrency-safe auto-coding for acquisition entities.
--
-- The previous implementation read MAX(code)+1 then INSERTed, which
-- races under bursty concurrent writes (verified: 50 concurrent creates
-- saw ~30% unique-constraint failures even with our retry helper).
--
-- Postgres sequences are atomic by design; nextval() returns a distinct
-- value to every caller without locking, so concurrent INSERTs cannot
-- collide.
--
-- Each sequence is seeded to MAX(existing) + 1 so codes already issued
-- by the old MAX+1 generator remain valid and never get reused.

CREATE SEQUENCE IF NOT EXISTS "acquisition_agent_code_seq"
  AS INTEGER
  MINVALUE 1
  START WITH 1;

CREATE SEQUENCE IF NOT EXISTS "acquisition_land_code_seq"
  AS INTEGER
  MINVALUE 1
  START WITH 1;

CREATE SEQUENCE IF NOT EXISTS "acquisition_building_code_seq"
  AS INTEGER
  MINVALUE 1
  START WITH 1;

-- Seed each sequence to the next unused code. setval(seq, n, false) makes
-- the next nextval() call return exactly n; combined with COALESCE(...,0)+1
-- this works whether the table is empty (next=1) or already has rows
-- (next=MAX+1). The "true" variant cannot be used here because it would
-- accept 0 as "last value used", and Postgres sequences with MINVALUE 1
-- reject setval(seq, 0, true).
SELECT setval(
  'acquisition_agent_code_seq',
  COALESCE(
    (SELECT MAX(CAST(SPLIT_PART("agentCode", '-', 2) AS INTEGER))
       FROM "AcquisitionAgent"
       WHERE "agentCode" ~ '^AGT-[0-9]+$'),
    0
  ) + 1,
  false
);

SELECT setval(
  'acquisition_land_code_seq',
  COALESCE(
    (SELECT MAX(CAST(SPLIT_PART("landCode", '-', 2) AS INTEGER))
       FROM "AcquisitionLand"
       WHERE "landCode" ~ '^LND-[0-9]+$'),
    0
  ) + 1,
  false
);

SELECT setval(
  'acquisition_building_code_seq',
  COALESCE(
    (SELECT MAX(CAST(SPLIT_PART("buildingCode", '-', 2) AS INTEGER))
       FROM "AcquisitionBuilding"
       WHERE "buildingCode" ~ '^BLD-[0-9]+$'),
    0
  ) + 1,
  false
);
