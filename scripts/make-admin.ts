/**
 * Gives an existing user the admin role, using DATABASE_URL from backend/.env.
 *
 *   bun run scripts/make-admin.ts someone@example.com           # make admin
 *   bun run scripts/make-admin.ts someone@example.com --revoke  # back to a normal user
 *
 * The user has to log out and back in for the new role to reach their session.
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const role = process.argv.includes("--revoke") ? "user" : "admin";
  if (!email || !email.includes("@")) {
    console.error("Usage: bun run scripts/make-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (!user) {
    console.error(`No user with email ${email}. They need to sign up first.`);
    process.exit(1);
  }
  if (user.role === role) {
    console.log(`${user.email} is already ${role}. Nothing changed.`);
    process.exit(0);
  }

  await db.update(users).set({ role, updatedAt: new Date() }).where(sql`${users.id} = ${user.id}`);
  console.log(`${user.email}: ${user.role} -> ${role}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to update role:", error);
  process.exit(1);
});
