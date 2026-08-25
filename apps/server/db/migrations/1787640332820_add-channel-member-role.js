/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE channel_members
    ADD COLUMN role TEXT NOT NULL DEFAULT 'MEMBER';

    ALTER TABLE channel_members
    ADD CONSTRAINT channel_members_role_check
    CHECK (role IN ('MEMBER', 'CHANNEL_MANAGER'));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE channel_members
    DROP CONSTRAINT channel_members_role_check;

    ALTER TABLE channel_members
    DROP COLUMN role;
  `);
};