import { db } from "../src/db/client";
import { users } from "../src/db/schema";

async function main() {
  try {
    const allUsers = await db.select().from(users);
    console.log(`\nFound ${allUsers.length} user(s):\n`);
    console.log(
      JSON.stringify(
        allUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          authProvider: u.authProvider,
          telegramId: u.telegramId,
          isVerified: u.isVerified,
          isBlocked: u.isBlocked,
          createdAt: u.createdAt,
        })),
        null,
        2
      )
    );
    process.exit(0);
  } catch (err) {
    console.error("Error fetching users:", err);
    process.exit(1);
  }
}

main();
