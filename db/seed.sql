-- ============================================================================
-- TUT Vision — Seed data (development / testing)
-- ----------------------------------------------------------------------------
-- Fills the database with the test data we built by hand, so the app has
-- something to show. Safe to re-run: it clears everything first, so you always
-- get the SAME state.
--
-- HOW TO RUN (PowerShell), against the tut_vision database:
--     psql -U postgres -d tut_vision -f db/seed.sql
--
-- NOTE: this DELETES all existing data every time it runs. That is the point of
-- a seed file (a known, repeatable starting state) — never run it against real
-- production data.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Clear everything first, so re-running never creates duplicates.
--   TRUNCATE         empties the tables completely.
--   RESTART IDENTITY resets auto-counting id columns back to 1 (predictable ids).
--   CASCADE          clears tables that reference each other without FK errors.
-- ----------------------------------------------------------------------------
TRUNCATE campus, faculty, department, users, status_state, status_message,
         consultation_slot, follow, device, geofence, biometric_enrolment,
         lobby_device
RESTART IDENTITY CASCADE;


-- ----------------------------------------------------------------------------
-- 1. Organisational hierarchy.
--    Thanks to RESTART IDENTITY, ids are deterministic: campus -> 1,
--    faculty -> 1, department -> 1. That is why we can reference them by number.
-- ----------------------------------------------------------------------------
INSERT INTO campus (name) VALUES ('Pretoria Campus');

INSERT INTO faculty (campus_id, name) VALUES (1, 'Faculty of ICT');

INSERT INTO department (faculty_id, name) VALUES (1, 'Computer Systems Engineering');


-- ----------------------------------------------------------------------------
-- 2. People. Users get random UUID ids, so we can NEVER hardcode them —
--    every later reference looks a user up by their (unique) email.
-- ----------------------------------------------------------------------------

-- Staff (the two lecturers)
INSERT INTO users (microsoft_oid, name, email, role, department_id) VALUES
    ('oid-staff-001', 'Dr Naledi Khumalo',  'n.khumalo@tut.ac.za', 'staff', 1),
    ('oid-staff-002', 'Prof Sipho Dlamini', 's.dlamini@tut.ac.za', 'staff', 1);

-- Students
INSERT INTO users (microsoft_oid, name, email, role, department_id) VALUES
    ('oid-stud-001', 'Thabo Mokoena', 'thabo.m@tutmail.ac.za',  'student', 1),
    ('oid-stud-002', 'Lerato Nkosi',  'lerato.n@tutmail.ac.za', 'student', 1);


-- ----------------------------------------------------------------------------
-- 3. Live status — one row per staff member (one-to-one).
-- ----------------------------------------------------------------------------
INSERT INTO status_state (user_id, availability, presence, presence_source) VALUES
    ((SELECT id FROM users WHERE email = 'n.khumalo@tut.ac.za'), 'available', 'on_campus', 'manual'),
    ((SELECT id FROM users WHERE email = 's.dlamini@tut.ac.za'), 'busy',      'on_campus', 'manual');


-- ----------------------------------------------------------------------------
-- 4. Status message — optional free text (one-to-many). Only Khumalo has one,
--    so the dashboard's LEFT JOIN has both cases to show (with and without).
-- ----------------------------------------------------------------------------
INSERT INTO status_message (user_id, text) VALUES
    ((SELECT id FROM users WHERE email = 'n.khumalo@tut.ac.za'), 'In office until 15:00, walk-ins welcome');


-- ----------------------------------------------------------------------------
-- 5. Follows — students following staff (many-to-many via the join table).
--    Two subqueries per row: one finds the student, one finds the staff member.
-- ----------------------------------------------------------------------------
INSERT INTO follow (student_id, staff_id) VALUES
    ((SELECT id FROM users WHERE email = 'thabo.m@tutmail.ac.za'),  (SELECT id FROM users WHERE email = 'n.khumalo@tut.ac.za')),
    ((SELECT id FROM users WHERE email = 'lerato.n@tutmail.ac.za'), (SELECT id FROM users WHERE email = 'n.khumalo@tut.ac.za'));

-- End of seed.
