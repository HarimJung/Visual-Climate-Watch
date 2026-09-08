-- Visual Climate — engine schema
-- Source: VC-TECH-SPEC-2026-001 v3.0, Part 2 (pp. 5-13), transcribed verbatim
-- except for the additions marked "P6". NOT EXECUTED at M1: the engine writes
-- files until M7. This file is the design reference until then.
--
-- P6 (ENGINE-BUILD.md §0.1) — the specification has no epistemic state. Ours
-- does, and it is the point of the product, so every table that stores a VALUE
-- carries `epistemic_state`. Reference tables (countries, data_sources) and
-- operational tables (etl_logs, quarantine) do not.

CREATE TYPE epistemic_state AS ENUM ('observed', 'pledged', 'unknown', 'absent');
-- observed: measured / reported inventory.       pledged: promised or projected.
-- unknown : not yet parsed or not published.     absent : the source confirms non-existence.
-- `absent` rows MUST carry absent_reason. A null value is never `absent`.


-- ─── 2.2 Reference ───────────────────────────────────────────────────────────

CREATE TABLE countries (
  iso3               CHAR(3)       PRIMARY KEY,
  iso2               CHAR(2)       UNIQUE NOT NULL,
  name_en            TEXT          NOT NULL,
  name_fr            TEXT,
  name_es            TEXT,
  name_ar            TEXT,
  name_zh            TEXT,
  name_ru            TEXT,
  region_wb          TEXT,            -- World Bank region
  subregion_un       TEXT,            -- UN subregion
  income_group       TEXT,            -- WB income group
  latitude           DECIMAL(9,6),
  longitude          DECIMAL(9,6),
  is_annex1          BOOLEAN DEFAULT FALSE,
  is_non_annex1      BOOLEAN DEFAULT FALSE,
  is_sids            BOOLEAN DEFAULT FALSE,
  is_ldc             BOOLEAN DEFAULT FALSE,
  is_lldc            BOOLEAN DEFAULT FALSE,   -- Landlocked Developing
  unfccc_group       TEXT,            -- 'G77','AOSIS','EU','AILAC','LMDCs', etc.
  population_latest  BIGINT,
  gdp_latest_usd     DECIMAL(18,2),
  area_km2           DECIMAL(12,2),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_countries_region ON countries(region_wb);
CREATE INDEX idx_countries_income ON countries(income_group);
CREATE INDEX idx_countries_groups ON countries(is_annex1, is_sids, is_ldc);

CREATE TABLE data_sources (
  source_id            TEXT      PRIMARY KEY,   -- 'DS-01'...'DS-40', 'DS-BTR', 'DS-NAP'
  name                 TEXT      NOT NULL,
  name_short           TEXT,
  organization         TEXT      NOT NULL,
  url                  TEXT,
  api_endpoint         TEXT,
  license              TEXT      NOT NULL,
  license_url          TEXT,
  can_expose_raw       BOOLEAN   DEFAULT TRUE,
  can_redistribute     BOOLEAN   DEFAULT TRUE,
  collection_pattern   CHAR(1)   NOT NULL CHECK (collection_pattern IN ('A','B','C','D')),
  frequency            TEXT,
  gwp_basis            TEXT,
  methodology_summary  TEXT,
  known_limitations    TEXT,
  citation             TEXT,
  data_start_year      SMALLINT,
  data_end_year        SMALLINT,
  country_coverage     SMALLINT,       -- number of countries
  estimated_records    INTEGER,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 2.2 Values ──────────────────────────────────────────────────────────────
-- R3: multiple sources for the same country-year are kept side by side. The
-- UNIQUE constraints all lead with source_id so nothing can silently merge.

CREATE TABLE emissions (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3     CHAR(3)       NOT NULL REFERENCES countries(iso3),
  source_id        TEXT          NOT NULL REFERENCES data_sources(source_id),
  gas              TEXT          NOT NULL,
  sector           TEXT,
  subsector        TEXT,
  year             SMALLINT      NOT NULL,
  value            DECIMAL(18,6),
  unit             TEXT          NOT NULL,
  gwp_basis        TEXT,
  is_preliminary   BOOLEAN       DEFAULT FALSE,
  retrieved_at     TIMESTAMPTZ   NOT NULL,
  file_sha256      TEXT,
  epistemic_state  epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason    TEXT,                                          -- P6
  UNIQUE (source_id, country_iso3, gas, sector, subsector, year),
  CONSTRAINT emissions_absent_needs_reason CHECK (epistemic_state <> 'absent' OR absent_reason IS NOT NULL),
  CONSTRAINT emissions_value_matches_state CHECK (value IS NOT NULL OR epistemic_state IN ('unknown','absent'))
);
CREATE INDEX idx_em_country_year ON emissions(country_iso3, year);
CREATE INDEX idx_em_source ON emissions(source_id);
CREATE INDEX idx_em_gas ON emissions(gas);
CREATE INDEX idx_em_sector ON emissions(sector) WHERE sector IS NOT NULL;
CREATE INDEX idx_em_year ON emissions(year);
-- composite index: country profile query
CREATE INDEX idx_em_profile ON emissions(country_iso3, gas, source_id, year) WHERE sector IS NULL;

CREATE TABLE climate_indicators (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3     CHAR(3)       REFERENCES countries(iso3),
  source_id        TEXT          NOT NULL REFERENCES data_sources(source_id),
  indicator        TEXT          NOT NULL,
  region           TEXT,
  year             SMALLINT      NOT NULL,
  month            SMALLINT,
  value            DECIMAL(12,4),
  unit             TEXT          NOT NULL,
  baseline_period  TEXT,
  scenario         TEXT,
  model            TEXT,
  retrieved_at     TIMESTAMPTZ   NOT NULL,
  epistemic_state  epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason    TEXT,                                          -- P6
  UNIQUE (source_id, country_iso3, indicator, region, year, month, scenario, model),
  CONSTRAINT ci_absent_needs_reason CHECK (epistemic_state <> 'absent' OR absent_reason IS NOT NULL)
);
CREATE INDEX idx_ci_country ON climate_indicators(country_iso3);
CREATE INDEX idx_ci_indicator ON climate_indicators(indicator);

CREATE TABLE vulnerability (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3     CHAR(3)       NOT NULL REFERENCES countries(iso3),
  source_id        TEXT          NOT NULL REFERENCES data_sources(source_id),
  indicator        TEXT          NOT NULL,
  component        TEXT,
  subcomponent     TEXT,
  year             SMALLINT      NOT NULL,
  value            DECIMAL(12,6),
  unit             TEXT,
  retrieved_at     TIMESTAMPTZ   NOT NULL,
  epistemic_state  epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason    TEXT,                                          -- P6
  UNIQUE (source_id, country_iso3, indicator, component, subcomponent, year),
  CONSTRAINT vuln_absent_needs_reason CHECK (epistemic_state <> 'absent' OR absent_reason IS NOT NULL)
);
CREATE INDEX idx_vuln_country ON vulnerability(country_iso3);

CREATE TABLE climate_finance (
  id                   BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3         CHAR(3)       REFERENCES countries(iso3),
  source_id            TEXT          NOT NULL REFERENCES data_sources(source_id),
  flow_type            TEXT,          -- 'mitigation','adaptation','cross-cutting','loss_and_damage'
  channel              TEXT,          -- 'multilateral','bilateral','private','domestic'
  instrument           TEXT,          -- 'grant','concessional_loan','equity','guarantee'
  provider             TEXT,
  fund_name            TEXT,
  year                 SMALLINT      NOT NULL,
  amount_usd           DECIMAL(18,2),
  currency_original    TEXT,
  amount_original      DECIMAL(18,2),
  retrieved_at         TIMESTAMPTZ   NOT NULL,
  epistemic_state      epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason        TEXT,                                          -- P6
  UNIQUE (source_id, country_iso3, flow_type, channel, instrument, provider, fund_name, year),
  CONSTRAINT fin_absent_needs_reason CHECK (epistemic_state <> 'absent' OR absent_reason IS NOT NULL)
);
CREATE INDEX idx_fin_country ON climate_finance(country_iso3);
CREATE INDEX idx_fin_type ON climate_finance(flow_type);
-- Need is not receipt. A funded project never proves an NDC condition was met.

CREATE TABLE disasters (
  id                  BIGINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  disaster_no         TEXT       UNIQUE NOT NULL,
  country_iso3        CHAR(3)    NOT NULL REFERENCES countries(iso3),
  source_id           TEXT       NOT NULL REFERENCES data_sources(source_id),
  disaster_group      TEXT,       -- 'Natural','Technological'
  disaster_type       TEXT       NOT NULL,
  disaster_subtype    TEXT,
  year                SMALLINT   NOT NULL,
  start_date          DATE,
  end_date            DATE,
  total_deaths        INTEGER,
  total_injured       INTEGER,
  total_affected      BIGINT,
  total_homeless      BIGINT,
  total_damage_usd    DECIMAL(18,2),
  insured_damage_usd  DECIMAL(18,2),
  is_climate_related  BOOLEAN    DEFAULT FALSE,
  retrieved_at        TIMESTAMPTZ NOT NULL,
  epistemic_state     epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason       TEXT                                           -- P6
);
CREATE INDEX idx_dis_country ON disasters(country_iso3);
CREATE INDEX idx_dis_type ON disasters(disaster_type);
CREATE INDEX idx_dis_climate ON disasters(is_climate_related) WHERE is_climate_related;
-- EM-DAT is Restricted (Appendix A): store the link, do not commit the values.

CREATE TABLE ndc_targets (
  id                       BIGINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3             CHAR(3)    NOT NULL REFERENCES countries(iso3),
  source_id                TEXT       NOT NULL REFERENCES data_sources(source_id),
  ndc_version              TEXT       NOT NULL,
  submission_date          DATE,
  target_type              TEXT,       -- 'absolute','BAU_reduction','intensity','peaking','carbon_budget'
  base_year                SMALLINT,
  base_year_emissions      DECIMAL(18,2),
  target_year              SMALLINT,
  target_value             DECIMAL(18,2),
  reduction_pct            DECIMAL(6,2),
  reduction_pct_conditional DECIMAL(6,2),
  conditionality           TEXT,
  sector_scope             TEXT,
  gas_scope                TEXT,
  lulucf_included          BOOLEAN,
  international_markets    BOOLEAN,
  net_zero_target_year     SMALLINT,
  net_zero_legislated      BOOLEAN,
  document_url             TEXT,
  extraction_confidence    TEXT       CHECK (extraction_confidence IN ('high','medium','low')),
  retrieved_at             TIMESTAMPTZ NOT NULL,
  -- P6: one state per independently-extractable figure. Cambodia publishes a
  -- target but no numeric conditional split; those cannot share one state.
  base_year_state          epistemic_state NOT NULL DEFAULT 'unknown',
  target_state             epistemic_state NOT NULL DEFAULT 'unknown',
  split_state              epistemic_state NOT NULL DEFAULT 'unknown',
  net_zero_state           epistemic_state NOT NULL DEFAULT 'unknown',
  absent_reason            TEXT,
  UNIQUE (source_id, country_iso3, ndc_version, target_year)
);

CREATE TABLE ndc_content (
  id                 BIGINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3       CHAR(3)    NOT NULL REFERENCES countries(iso3),
  ndc_version        TEXT       NOT NULL,
  global_category    TEXT       NOT NULL,
  overview_category  TEXT,
  sector             TEXT,
  subsector          TEXT,
  indicator_id       TEXT       NOT NULL,
  indicator_name     TEXT       NOT NULL,
  value              TEXT,         -- free-text value from the NDC
  retrieved_at       TIMESTAMPTZ NOT NULL,
  epistemic_state    epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason      TEXT,                                          -- P6
  UNIQUE (country_iso3, ndc_version, indicator_id, sector, subsector)
);
CREATE INDEX idx_ndc_content_country ON ndc_content(country_iso3);
CREATE INDEX idx_ndc_content_indicator ON ndc_content(indicator_id);

-- P6 OVERRIDE, and the reason this project exists.
-- The specification stores eight has_* BOOLEANs. A boolean cannot say "we have
-- not read the document yet", so `false` would mean both "not submitted" and
-- "not parsed". Cambodia submitted BTR1 on 2024-12-31; recording its components
-- as false would be a false accusation against a real government. Each
-- component is therefore a four-state column, and `absent` needs evidence.
CREATE TABLE btr_status (
  id                   BIGINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3         CHAR(3)    NOT NULL REFERENCES countries(iso3),
  btr_version          TEXT       NOT NULL DEFAULT 'BTR1',
  submitted            BOOLEAN,                 -- P6: nullable. NULL = unparsed.
  submission_date      DATE,
  published_date       DATE,
  -- component presence (spec: has_nir BOOLEAN … → P6: four-state)
  state_nir            epistemic_state NOT NULL DEFAULT 'unknown',  -- National Inventory Report
  state_crt            epistemic_state NOT NULL DEFAULT 'unknown',  -- Common Reporting Tables
  state_ctf            epistemic_state NOT NULL DEFAULT 'unknown',  -- Common Tabular Formats
  state_ndc_track      epistemic_state NOT NULL DEFAULT 'unknown',  -- NDC progress tracking
  state_adaptation     epistemic_state NOT NULL DEFAULT 'unknown',  -- Adaptation chapter
  state_finance        epistemic_state NOT NULL DEFAULT 'unknown',  -- Finance / support info
  state_redd_plus      epistemic_state NOT NULL DEFAULT 'unknown',  -- REDD+ annex
  state_article6       epistemic_state NOT NULL DEFAULT 'unknown',  -- Article 6 cooperation
  -- evidence for each promotion out of 'unknown': section anchor or attachment name
  evidence             JSONB      NOT NULL DEFAULT '{}'::jsonb,
  -- quality
  inventory_years      TEXT,       -- e.g. '1990-2022'
  gases_covered        TEXT,       -- 'CO2,CH4,N2O,HFCs,PFCs,SF6,NF3'
  sectors_covered      TEXT,       -- 'Energy,IPPU,Agriculture,LULUCF,Waste'
  document_url         TEXT,
  synthesis_notes      TEXT,
  retrieved_at         TIMESTAMPTZ NOT NULL,
  UNIQUE (country_iso3, btr_version)
);
CREATE INDEX idx_btr_submitted ON btr_status(submitted);

CREATE TABLE nap_status (
  id                   BIGINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3         CHAR(3)    NOT NULL REFERENCES countries(iso3),
  has_nap              BOOLEAN,     -- P6: nullable, was DEFAULT FALSE
  nap_submission_date  DATE,
  nap_document_url     TEXT,
  -- adaptation focus areas
  focus_agriculture    BOOLEAN,
  focus_water          BOOLEAN,
  focus_health         BOOLEAN,
  focus_infrastructure BOOLEAN,
  focus_ecosystems     BOOLEAN,
  focus_coastal        BOOLEAN,
  focus_energy         BOOLEAN,
  focus_urban          BOOLEAN,
  -- linkage
  nap_ndc_aligned      BOOLEAN,     -- is the NAP aligned with the NDC adaptation goals
  monitoring_framework BOOLEAN,     -- an M&E framework exists
  retrieved_at         TIMESTAMPTZ NOT NULL,
  epistemic_state      epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason        TEXT,                                          -- P6
  UNIQUE (country_iso3)
);

CREATE TABLE reduction_potential (
  id                   BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3         CHAR(3)       NOT NULL REFERENCES countries(iso3),
  source_id            TEXT          NOT NULL REFERENCES data_sources(source_id),
  sector               TEXT          NOT NULL,
  subsector            TEXT,
  strategy             TEXT          NOT NULL,
  current_emissions    DECIMAL(18,3),
  reduction_potential  DECIMAL(18,3),
  unit                 TEXT DEFAULT 'tonnes CO2eq/year',
  year                 SMALLINT,
  asset_count          INTEGER,
  retrieved_at         TIMESTAMPTZ   NOT NULL,
  epistemic_state      epistemic_state NOT NULL DEFAULT 'unknown',   -- P6
  absent_reason        TEXT,                                          -- P6
  UNIQUE (source_id, country_iso3, sector, subsector, strategy, year)
);
CREATE INDEX idx_rp_country ON reduction_potential(country_iso3);
CREATE INDEX idx_rp_sector ON reduction_potential(sector);

CREATE TABLE country_projections (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_iso3     CHAR(3)       NOT NULL REFERENCES countries(iso3),
  source_id        TEXT          NOT NULL REFERENCES data_sources(source_id),
  variable         TEXT          NOT NULL,   -- 'tas','pr','tasmax','tasmin'
  scenario         TEXT          NOT NULL,   -- 'SSP1-2.6','SSP2-4.5','SSP3-7.0','SSP5-8.5'
  model            TEXT,                     -- 'ensemble' or a specific CMIP6 model
  period           TEXT          NOT NULL,   -- '2020-2039','2040-2059','2060-2079','2080-2099'
  aggregation      TEXT          NOT NULL,   -- 'annual','seasonal','monthly'
  statistic        TEXT          NOT NULL,   -- 'mean','median','p10','p90'
  value            DECIMAL(10,4),
  anomaly          DECIMAL(10,4),            -- change against the baseline
  unit             TEXT          NOT NULL,
  baseline_period  TEXT,
  retrieved_at     TIMESTAMPTZ   NOT NULL,
  epistemic_state  epistemic_state NOT NULL DEFAULT 'pledged',   -- P6: projections are never observations
  absent_reason    TEXT,
  UNIQUE (source_id, country_iso3, variable, scenario, model, period, aggregation, statistic)
);


-- ─── 2.2 Operations ──────────────────────────────────────────────────────────
-- P1-P5 audit trail. No epistemic_state: these describe runs, not the world.

CREATE TABLE etl_logs (
  run_id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         TEXT          NOT NULL REFERENCES data_sources(source_id),
  started_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  status            TEXT          NOT NULL DEFAULT 'running'
                                  CHECK (status IN ('running','success','partial','failed')),
  record_count      INTEGER       DEFAULT 0,
  inserted_count    INTEGER       DEFAULT 0,
  updated_count     INTEGER       DEFAULT 0,
  skipped_count     INTEGER       DEFAULT 0,
  quarantine_count  INTEGER       DEFAULT 0,
  file_sha256       TEXT,
  file_size_bytes   BIGINT,
  api_url           TEXT,
  error_message     TEXT,
  duration_ms       INTEGER,
  triggered_by      TEXT          DEFAULT 'cron'
);

CREATE TABLE quarantine (
  id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id           UUID          REFERENCES etl_logs(run_id),
  source_id        TEXT          NOT NULL,
  raw_data         JSONB         NOT NULL,
  error_type       TEXT          NOT NULL,
  error_detail     TEXT,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      TEXT
);


-- ─── 2.3 RLS (M7, with Supabase) ─────────────────────────────────────────────
DO $$ DECLARE tbl TEXT; BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'countries','data_sources','emissions','climate_indicators',
    'vulnerability','climate_finance','disasters','ndc_targets',
    'ndc_content','btr_status','nap_status','reduction_potential',
    'country_projections'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY "public_read" ON %I FOR SELECT USING (true)', tbl);
  END LOOP;
END $$;

ALTER TABLE etl_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read" ON etl_logs   FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_read" ON quarantine FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
