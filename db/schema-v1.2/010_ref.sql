-- =============================================================================
-- 010_ref.sql — Référentiels : devises, langues, régions de données, pays,
--               taux de change, taxes
-- Tables globales (pas de tenant), éditées depuis le back-office.
-- =============================================================================

CREATE TABLE ref.currencies (
  code         char(3)     PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),   -- XAF, XOF, EUR, USD
  name         jsonb       NOT NULL CHECK (util.is_i18n(name)),
  symbol       text        NOT NULL,
  minor_units  smallint    NOT NULL CHECK (minor_units BETWEEN 0 AND 4), -- XAF=0, EUR=2
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ref.languages (
  code        text        PRIMARY KEY CHECK (code ~ '^[a-z]{2}(-[A-Z]{2})?$'), -- fr, en
  name        jsonb       NOT NULL CHECK (util.is_i18n(name)),
  is_active   boolean     NOT NULL DEFAULT true,
  is_default  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX languages_single_default_uq ON ref.languages (is_default) WHERE is_default;

-- Région physique d'hébergement des données (V1 : eu-fr / OVH ; plus tard région Afrique)
CREATE TABLE ref.data_regions (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  code             text        NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]+$'), -- eu-fr, af-cm
  name             jsonb       NOT NULL CHECK (util.is_i18n(name)),
  hosting_provider text        NOT NULL,                  -- ovh, ...
  location         text        NOT NULL,                  -- "Gravelines, FR"
  country_code     char(2)     NOT NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  is_default       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX data_regions_single_default_uq ON ref.data_regions (is_default) WHERE is_default;

CREATE TABLE ref.countries (
  code                   char(2)     PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),  -- CM, CI, SN, FR
  name                   jsonb       NOT NULL CHECK (util.is_i18n(name)),
  default_currency       char(3)     NOT NULL REFERENCES ref.currencies(code),
  default_language       text        NOT NULL REFERENCES ref.languages(code),
  default_data_region_id bigint      REFERENCES ref.data_regions(id),
  phone_prefix           text        NOT NULL CHECK (phone_prefix ~ '^\+[0-9]{1,4}$'),
  is_active              boolean     NOT NULL DEFAULT true,
  is_signup_allowed      boolean     NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX countries_default_currency_idx ON ref.countries (default_currency);
CREATE INDEX countries_default_language_idx ON ref.countries (default_language);
CREATE INDEX countries_default_region_idx   ON ref.countries (default_data_region_id);

-- Taux de change historisés (1 base = rate quote). Le calcul des crédits
-- référence le taux exact utilisé (traçabilité de chaque débit).
CREATE TABLE ref.fx_rates (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  base_currency  char(3)        NOT NULL REFERENCES ref.currencies(code),
  quote_currency char(3)        NOT NULL REFERENCES ref.currencies(code),
  rate           numeric(24,12) NOT NULL CHECK (rate > 0),
  source         text           NOT NULL,          -- ecb, beac, manual, provider...
  effective_at   timestamptz    NOT NULL,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  CHECK (base_currency <> quote_currency),
  UNIQUE (base_currency, quote_currency, effective_at)
);
-- "dernier taux connu" : ORDER BY effective_at DESC LIMIT 1 couvert par l'unique ci-dessus
CREATE INDEX fx_rates_quote_idx ON ref.fx_rates (quote_currency);

-- Taxes (TVA...) par pays, sans chevauchement de périodes
CREATE TABLE ref.tax_rates (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid         NOT NULL DEFAULT uuidv7() UNIQUE,
  country_code     char(2)      NOT NULL REFERENCES ref.countries(code),
  tax_type         text         NOT NULL CHECK (tax_type IN ('vat','sales_tax','withholding','other')),
  applies_to       text         NOT NULL DEFAULT 'all'
                   CHECK (applies_to IN ('all','subscription','credits','marketplace')),
  name             jsonb        NOT NULL CHECK (util.is_i18n(name)),
  rate             numeric(7,4) NOT NULL CHECK (rate >= 0 AND rate < 1),  -- 0.1925
  effective_during tstzrange    NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  EXCLUDE USING gist (country_code WITH =, tax_type WITH =, applies_to WITH =,
                      effective_during WITH &&)
);
