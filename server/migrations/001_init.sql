-- MIFTAH core schema. Properties (the physical asset) are stored separately from listings (ads).

CREATE TABLE advertisers (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type        text NOT NULL CHECK (type IN ('owner','company','marketer')),
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  license     text,
  cr_number   text,
  verified    text NOT NULL DEFAULT 'pending' CHECK (verified IN ('verified','pending','rejected')),
  joined      date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE users (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  phone          text,
  name_ar        text NOT NULL,
  name_en        text NOT NULL,
  role           text NOT NULL CHECK (role IN ('seeker','owner','company','marketer','admin','supervisor')),
  advertiser_id  text REFERENCES advertisers(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((role IN ('owner','company','marketer')) = (advertiser_id IS NOT NULL))
);

-- Simulated Riyadh Municipality spatial portal records (never real government data).
CREATE TABLE land_records (
  code         text PRIMARY KEY,
  district_id  text NOT NULL,
  area         numeric NOT NULL,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  source       text NOT NULL DEFAULT 'simulated'
);

CREATE TABLE properties (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  land_code     text UNIQUE REFERENCES land_records(code),
  identity      text NOT NULL CHECK (identity IN ('simulated_verified','unidentified')),
  type          text NOT NULL CHECK (type IN ('apartment','villa','floor','land','office','shop')),
  district_id   text NOT NULL,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  area          numeric NOT NULL CHECK (area > 0),
  rooms         int NOT NULL DEFAULT 0,
  baths         int NOT NULL DEFAULT 0,
  features      text[] NOT NULL DEFAULT '{}',
  availability  text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','sold','rented')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((land_code IS NULL) = (identity = 'unidentified'))
);

CREATE TABLE listings (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id    text NOT NULL REFERENCES properties(id),
  advertiser_id  text NOT NULL REFERENCES advertisers(id),
  land_code      text,               -- copied from the property by trigger; used by the duplicate index
  deal           text NOT NULL CHECK (deal IN ('sale','rent')),
  price          numeric NOT NULL CHECK (price > 0),
  title_ar       text NOT NULL,
  title_en       text NOT NULL,
  desc_ar        text NOT NULL DEFAULT '',
  desc_en        text NOT NULL DEFAULT '',
  image_seed     int NOT NULL DEFAULT 1,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','under_review','closed')),
  closed_reason  text CHECK (closed_reason IN ('sold','rented')),
  featured       boolean NOT NULL DEFAULT false,
  views          int NOT NULL DEFAULT 0,
  ad_license     text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Duplicate prevention at the database level:
-- one live ad per advertiser account per land code. Different accounts may share a land code.
CREATE UNIQUE INDEX listings_one_live_ad_per_land_code
  ON listings (advertiser_id, land_code)
  WHERE land_code IS NOT NULL AND status IN ('active','paused','under_review');

CREATE INDEX listings_property_idx ON listings (property_id);
CREATE INDEX listings_status_idx ON listings (status);
CREATE INDEX properties_district_idx ON properties (district_id);

-- Keep listings.land_code equal to the property's land code so it cannot be faked by the client.
CREATE FUNCTION listings_copy_land_code() RETURNS trigger AS $$
BEGIN
  SELECT land_code INTO NEW.land_code FROM properties WHERE id = NEW.property_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER listings_land_code_trg
  BEFORE INSERT OR UPDATE OF property_id, land_code ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_copy_land_code();

CREATE TABLE listing_images (
  id          serial PRIMARY KEY,
  listing_id  text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url         text NOT NULL,
  sort        int NOT NULL DEFAULT 0
);

CREATE TABLE conversations (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  listing_id     text NOT NULL REFERENCES listings(id),
  seeker_id      text NOT NULL REFERENCES users(id),
  advertiser_id  text NOT NULL REFERENCES advertisers(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, seeker_id)
);

CREATE TABLE messages (
  id               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id  text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        text NOT NULL,   -- user id (seeker) or advertiser id
  body             text NOT NULL,
  flagged          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE favorites (
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id  text NOT NULL REFERENCES properties(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE status_requests (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id    text NOT NULL REFERENCES properties(id),
  listing_id     text NOT NULL REFERENCES listings(id),
  advertiser_id  text NOT NULL REFERENCES advertisers(id),
  outcome        text NOT NULL CHECK (outcome IN ('sold','rented')),
  value          numeric NOT NULL CHECK (value > 0),
  state          text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
  reviewed_by    text REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX status_requests_one_pending ON status_requests (listing_id) WHERE state = 'pending';

CREATE TABLE status_history (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id  text NOT NULL REFERENCES properties(id),
  from_status  text NOT NULL,
  to_status    text NOT NULL,
  by_user      text NOT NULL,
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE duplicate_attempts (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  advertiser_id        text NOT NULL REFERENCES advertisers(id),
  land_code            text NOT NULL,
  existing_listing_id  text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id    text NOT NULL REFERENCES properties(id),
  listing_id     text NOT NULL REFERENCES listings(id),
  advertiser_id  text NOT NULL REFERENCES advertisers(id),
  value          numeric NOT NULL,
  commission     numeric NOT NULL,
  rule           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recipient   text NOT NULL,          -- user id or advertiser id
  text_ar     text NOT NULL,
  text_en     text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient);

CREATE TABLE reports (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  listing_id  text NOT NULL REFERENCES listings(id),
  by_user     text NOT NULL REFERENCES users(id),
  reason      text NOT NULL,
  open        boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_log (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  by_user     text NOT NULL,
  action      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
