-- Simulated payments (booking deposit for sales, first rent payment). Additive: does not touch existing data.
-- No card numbers or full national IDs are ever stored: only the last 4 digits for the receipt.
CREATE TABLE payments (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_no      text NOT NULL UNIQUE,
  listing_id      text NOT NULL REFERENCES listings(id),
  property_id     text NOT NULL REFERENCES properties(id),
  advertiser_id   text NOT NULL REFERENCES advertisers(id),
  payer_id        text NOT NULL REFERENCES users(id),
  kind            text NOT NULL CHECK (kind IN ('sale_deposit','rent_payment')),
  installments    int CHECK (installments IN (1,2,4)),
  items           jsonb NOT NULL,
  vat             numeric NOT NULL DEFAULT 0,
  total           numeric NOT NULL CHECK (total > 0),
  method          text NOT NULL CHECK (method IN ('mada','visa','mastercard','applepay','stcpay')),
  last4           text CHECK (last4 ~ '^[0-9]{4}$'),
  payer_name      text NOT NULL,
  payer_id_last4  text NOT NULL CHECK (payer_id_last4 ~ '^[0-9]{4}$'),
  payer_phone     text NOT NULL,
  status          text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid')),
  simulated       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_payer_idx ON payments (payer_id);
CREATE INDEX payments_advertiser_idx ON payments (advertiser_id);
