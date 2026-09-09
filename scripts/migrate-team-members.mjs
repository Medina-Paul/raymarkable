import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function runMigration() {
  console.log("Running migration for team_members...");

  try {
    // 1. Create team_members table
    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    console.log("✓ team_members table ready");

    // 2. Create constraints and indexes
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_uq ON team_members (team_id, user_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members (team_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members (user_id);
    `;
    console.log("✓ indexes ready");

    // 3. Backfill existing user team associations
    const backfilled = await sql`
      INSERT INTO team_members (team_id, user_id, role, joined_at)
      SELECT u.team_id, u.id, CASE WHEN t.created_by = u.id THEN 'leader' ELSE 'member' END, COALESCE(t.created_at, NOW())
      FROM users u
      JOIN teams t ON t.id = u.team_id
      WHERE u.team_id IS NOT NULL
      ON CONFLICT (team_id, user_id) DO NOTHING
      RETURNING id;
    `;
    console.log(`✓ backfilled ${backfilled.length} existing team memberships`);

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await sql.end();
  }
}

runMigration();
