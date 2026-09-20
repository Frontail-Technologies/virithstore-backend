import { db } from "../../db/client";
import { accountsVault, products } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";

export class AccountsVaultService {
  static async getAccounts(productId?: string, costId?: string) {
    let conditions = [];
    if (productId && productId !== "all") {
      conditions.push(eq(accountsVault.productId, productId));
    }
    if (costId && costId !== "all") {
      conditions.push(eq(accountsVault.costId, costId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const list = await db
      .select({
        id: accountsVault.id,
        productId: {
          id: products.id,
          name: products.name,
        },
        costId: accountsVault.costId,
        email: accountsVault.email,
        password: accountsVault.password,
        additionalInfo: accountsVault.additionalInfo,
        isActive: accountsVault.isActive,
        isReserved: accountsVault.isReserved,
        createdAt: accountsVault.createdAt,
      })
      .from(accountsVault)
      .leftJoin(products, eq(accountsVault.productId, products.id))
      .where(whereClause as any)
      .orderBy(desc(accountsVault.createdAt));

    return list;
  }

  static async upsertAccount(id?: string, data?: any) {
    if (id) {
      const [updated] = await db
        .update(accountsVault)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(accountsVault.id, id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(accountsVault)
        .values(data)
        .returning();
      return created;
    }
  }

  static async deleteAccount(id: string) {
    await db.delete(accountsVault).where(eq(accountsVault.id, id));
    return true;
  }
}
