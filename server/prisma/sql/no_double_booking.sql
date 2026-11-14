-- Safety net for FR-021 / FR-023: the database itself refuses two CONFIRMED
-- bookings for the same room whose time ranges overlap. Safe to run repeatedly.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_valid_interval;
ALTER TABLE bookings ADD CONSTRAINT bookings_valid_interval CHECK (end_time > start_time);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, tsrange(start_time, end_time) WITH &&)
  WHERE (status = 'CONFIRMED');
