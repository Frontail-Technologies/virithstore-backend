import { db } from "../../db/client";
import { orders, type NewOrder } from "../../db/schema/orders";
import { orderLogs } from "../../db/schema/orderLogs";
import { products } from "../../db/schema/products";
import { coupons } from "../../db/schema/coupons";
import { users } from "../../db/schema/users";
import { accountsVault } from "../../db/schema/accountsVault";
import { eq, and, or, desc, sql, gte, lt } from "drizzle-orm";
import { NotFoundError, AppError } from "../../shared/errors";

export class OrdersService {
  static async createOrder(data: {
    userId?: string;
    userEmail?: string;
    productId: string;
    packageId: string;
    couponCode?: string;
    credentials: Record<string, any>;
    paymentMethod?: string;
  }) {
    // 1. Fetch product
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, data.productId))
      .limit(1);

    if (!product || !product.isAvailable) {
      throw new AppError("Product is currently unavailable", 400);
    }

    // 2. Match package
    const pkg = product.cost.find((c) => c.id === data.packageId);
    if (!pkg) {
      throw new AppError("Invalid package selected", 400);
    }

    let price = parseFloat(pkg.price);
    const originalPrice = price;
    let discount = 0;

    // 3. Apply coupon if provided
    if (data.couponCode) {
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(eq(coupons.code, data.couponCode.toUpperCase()))
        .limit(1);

      if (coupon && coupon.isActive) {
        const minOrder = parseFloat(coupon.minOrderAmount);
        if (price >= minOrder) {
          if (coupon.discountType === "percentage") {
            const discVal = parseFloat(coupon.discountValue);
            discount = (price * discVal) / 100;
            if (coupon.maxDiscount) {
              discount = Math.min(discount, parseFloat(coupon.maxDiscount));
            }
          } else {
            discount = parseFloat(coupon.discountValue);
          }
          price = Math.max(0, price - discount);

          // Increment coupon used count
          await db
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.id, coupon.id));
        }
      }
    }

    // 4. Reserve stock for account-type products before charging the customer.
    // Reservation expires after 15 minutes if payment never completes.
    let reservedAccountId: string | null = null;
    if (product.type === "account") {
      const [availableAccount] = await db
        .select()
        .from(accountsVault)
        .where(
          and(
            eq(accountsVault.productId, product.id),
            eq(accountsVault.costId, pkg.id),
            eq(accountsVault.isActive, true),
            or(eq(accountsVault.isReserved, false), lt(accountsVault.reservedExpiry, new Date()))
          )
        )
        .limit(1);

      if (!availableAccount) {
        throw new AppError("This package is currently out of stock", 400);
      }

      await db
        .update(accountsVault)
        .set({ isReserved: true, reservedExpiry: new Date(Date.now() + 15 * 60 * 1000), updatedAt: new Date() })
        .where(eq(accountsVault.id, availableAccount.id));

      reservedAccountId = availableAccount.id;
    }

    // 5. Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const isPointsPayment = data.paymentMethod === "points";

    // If paying with points, verify user and deduct points
    if (isPointsPayment) {
      if (!data.userId) {
        throw new AppError("You must be logged in to pay with Virith Points", 401);
      }
      const pointsRequired = Math.round(price * 100);
      const { WalletService } = await import("../wallet/wallet.service");
      await WalletService.adjustPoints({
        userId: data.userId,
        points: -pointsRequired,
        type: "order_payment",
        description: `Instant Points checkout: ${product.name} - ${pkg.name || pkg.amount} (${pointsRequired} PTS)`,
      });
    }

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber,
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productType: product.type,
        packageId: pkg.id,
        packageName: pkg.name || pkg.amount || "Package",
        price: price.toFixed(2),
        originalPrice: originalPrice.toFixed(2),
        couponCode: data.couponCode || null,
        discount: discount.toFixed(2),
        status: isPointsPayment ? "processing" : "pending",
        paymentMethod: data.paymentMethod || "aba-khqr",
        paymentStatus: isPointsPayment ? "paid" : "pending",
        credentials: data.credentials,
        deliveryData: reservedAccountId ? { reservedAccountId } : undefined,
      })
      .returning();

    // Log creation
    await db.insert(orderLogs).values({
      orderId: order.id,
      action: isPointsPayment ? "ORDER_PAID_WITH_POINTS" : "ORDER_CREATED",
      performedBy: data.userEmail || data.userId || "guest",
      details: { price, credentials: data.credentials, isPointsPayment },
    });

    if (isPointsPayment) {
      const fulfilled = await this.fulfillOrder(order.id);
      return fulfilled || order;
    }

    return order;
  }

  /**
   * Runs once payment has been verified as approved. Atomically claims the order for
   * processing (so a duplicate webhook delivery can't fulfill it twice), then for
   * account-type products assigns the account reserved at checkout and marks it sold.
   * Digital-service products are marked completed directly since there's no external
   * provider integration to call.
   */
  static async fulfillOrder(orderId: string) {
    const [locked] = await db
      .update(orders)
      .set({ paymentStatus: "paid", status: "processing", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), sql`${orders.paymentStatus} != 'paid'`))
      .returning();

    if (!locked) {
      // Already paid/processed by a previous webhook delivery — nothing to do.
      return null;
    }

    // Grant a spin wheel credit if this purchase qualifies (product opted in via
    // spinActive + spinCostIds) — spins are earned, not given to every visitor.
    if (locked.userId) {
      const [product] = await db.select().from(products).where(eq(products.id, locked.productId!)).limit(1);
      if (product?.spinActive && product.spinCostIds.includes(locked.packageId)) {
        const { SpinService } = await import("../spin/spin.service");
        await SpinService.grantCredit(locked.userId, locked.id);
      }
    }

    if (locked.productType === "account") {
      const reservedAccountId = (locked.deliveryData as any)?.reservedAccountId;

      const [account] = reservedAccountId
        ? await db.select().from(accountsVault).where(eq(accountsVault.id, reservedAccountId)).limit(1)
        : [];

      if (account && account.isActive) {
        await db
          .update(accountsVault)
          .set({ isActive: false, isReserved: false, reservedExpiry: null, updatedAt: new Date() })
          .where(eq(accountsVault.id, account.id));

        const [fulfilled] = await db
          .update(orders)
          .set({
            status: "completed",
            deliveryData: {
              email: account.email,
              password: account.password,
              additionalInfo: account.additionalInfo,
            },
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId))
          .returning();

        await db.insert(orderLogs).values({
          orderId,
          action: "ACCOUNT_DELIVERED",
          performedBy: "PayWay Webhook",
          details: { accountId: account.id },
        });

        // Trigger referral commission reward
        try {
          const { ReferralsService } = await import("../referrals/referrals.service");
          await ReferralsService.processOrderReferral(fulfilled);
        } catch (refErr) {
          console.error("Referral reward error on account delivery:", refErr);
        }

        return fulfilled;
      }

      // Reservation expired/was taken by another order — payment succeeded but nothing
      // to deliver. Leave it pending so an admin can manually assign a replacement.
      const [pending] = await db
        .update(orders)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning();

      await db.insert(orderLogs).values({
        orderId,
        action: "ACCOUNT_DELIVERY_FAILED",
        performedBy: "PayWay Webhook",
        details: { reservedAccountId, error: "Reserved account no longer available" },
      });

      return pending;
    }

    const [completed] = await db
      .update(orders)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    // Trigger referral commission reward
    try {
      const { ReferralsService } = await import("../referrals/referrals.service");
      await ReferralsService.processOrderReferral(completed);
    } catch (refErr) {
      console.error("Referral reward error on completion:", refErr);
    }

    return completed;
  }

  static async getUserOrders(userId: string) {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  static async getById(id: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return order;
  }

  static async getByOrderNumber(orderNumber: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return order;
  }

  static async getAllOrders(params?: {
    status?: any;
    paymentStatus?: any;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params?.status) {
      conditions.push(eq(orders.status, params.status));
    }
    if (params?.paymentStatus) {
      conditions.push(eq(orders.paymentStatus, params.paymentStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(whereClause);

    return {
      items,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  static async updateStatus(
    id: string,
    status: "pending" | "processing" | "completed" | "cancelled" | "failed",
    performedBy: string,
    deliveryData?: Record<string, any>
  ) {
    const [updated] = await db
      .update(orders)
      .set({
        status,
        deliveryData: deliveryData ? deliveryData : undefined,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Order not found");
    }

    // Log status change
    await db.insert(orderLogs).values({
      orderId: id,
      action: `STATUS_UPDATED_${status.toUpperCase()}`,
      performedBy,
      details: { status, deliveryData },
    });

    // Trigger referral commission reward if completed
    if (status === "completed") {
      try {
        const { ReferralsService } = await import("../referrals/referrals.service");
        await ReferralsService.processOrderReferral(updated);
      } catch (refErr) {
        console.error("Referral reward error on admin order completion:", refErr);
      }
    }

    return updated;
  }

  static async getLiveFeed(limit = 25) {
    const list = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        productName: orders.productName,
        packageName: orders.packageName,
        price: orders.price,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return list.map((o) => {
      const num = o.orderNumber || o.id;
      const maskedId = num.length > 4 ? `ORD-***${num.slice(-4)}` : `ORD-${num}`;
      return {
        id: o.id,
        maskedId,
        productName: o.productName,
        packageName: o.packageName,
        amount: o.price,
        status: o.status,
        paymentStatus: o.paymentStatus,
        timestamp: o.createdAt,
      };
    });
  }

  static async getAnalytics() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const [[{ orderCount }], [{ productCount }], [{ userCount }], [{ todaysOrders }]] = await Promise.all([
      db.select({ orderCount: sql<number>`count(*)::int` }).from(orders),
      db.select({ productCount: sql<number>`count(*)::int` }).from(products).where(eq(products.isAvailable, true)),
      db.select({ userCount: sql<number>`count(*)::int` }).from(users),
      db
        .select({ todaysOrders: sql<number>`count(*)::int` })
        .from(orders)
        .where(gte(orders.createdAt, todayStart)),
    ]);

    // Total revenue & today & monthly income
    const [incomeData] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(case when ${orders.status} = 'completed' or ${orders.paymentStatus} = 'paid' then ${orders.price}::numeric else 0 end), 0)::float`,
        todaysIncome: sql<number>`coalesce(sum(case when (${orders.status} = 'completed' or ${orders.paymentStatus} = 'paid') and ${orders.createdAt} >= ${todayStart.toISOString()} then ${orders.price}::numeric else 0 end), 0)::float`,
        monthlyIncome: sql<number>`coalesce(sum(case when (${orders.status} = 'completed' or ${orders.paymentStatus} = 'paid') and ${orders.createdAt} >= ${monthStart.toISOString()} and ${orders.createdAt} < ${nextMonthStart.toISOString()} then ${orders.price}::numeric else 0 end), 0)::float`,
      })
      .from(orders);

    // Weekly sales
    const weeklySalesRows = await db
      .select({
        _id: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${orders.price}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, oneWeekAgo), lt(orders.createdAt, now)))
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);

    // Monthly sales
    const monthlySalesRows = await db
      .select({
        _id: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${orders.price}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, sixMonthsAgo), lt(orders.createdAt, now)))
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`);

    // Order status counts
    const orderStatusCounts = await db
      .select({
        _id: orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .groupBy(orders.status);

    // Top products
    const topProducts = await db
      .select({
        _id: orders.productId,
        totalSales: sql<number>`coalesce(sum(${orders.price}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
        productDetails: sql<any>`json_build_object('name', coalesce(max(${orders.productName}), 'Product'), 'price', coalesce(max(${orders.price}), '0'))`,
      })
      .from(orders)
      .groupBy(orders.productId)
      .orderBy(desc(sql`sum(${orders.price}::numeric)`))
      .limit(5);

    return {
      orders: orderCount,
      todaysOrders,
      products: productCount,
      customers: userCount,
      revenue: incomeData?.totalRevenue || 0,
      todaysIncome: incomeData?.todaysIncome || 0,
      monthlyIncome: incomeData?.monthlyIncome || 0,
      weeklySales: weeklySalesRows,
      monthlySales: monthlySalesRows,
      orderStatusCounts,
      topProducts,
    };
  }
}

