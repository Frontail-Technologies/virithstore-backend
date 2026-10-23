import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { CreateGift, UpdateGift, UpdateGiftTransactionStatus } from "./model";
import {
  claimGift,
  createGift,
  deleteGift,
  getPublicGift,
  getUserWagering,
  listGiftTransactions,
  listPublicGifts,
  updateGift,
  updateGiftTransactionStatus,
} from "./service";

export const giftsFeature = new Elysia({ prefix: "/gifts", name: "feature.gifts", tags: ["Gifts"] })
  .use(authPlugin)
  .get("/", async () => ok(await listPublicGifts()))
  .get("/wagering", async ({ user }) => ok(await getUserWagering(user.id)), { auth: true })
  .post("/claim/:id", async ({ params, user }) => ok(await claimGift(params.id, user.id), "Gift claimed successfully"), {
    auth: true,
    params: IdParam,
  })
  .get("/:id", async ({ params }) => ok(await getPublicGift(params.id)), { params: IdParam })
  .post("/", async ({ body }) => created(await createGift(body), "Gift created successfully"), {
    admin: true,
    body: CreateGift,
  })
  .put("/:id", async ({ params, body }) => ok(await updateGift(params.id, body), "Gift updated successfully"), {
    admin: true,
    params: IdParam,
    body: UpdateGift,
  })
  .delete("/:id", async ({ params }) => ok(await deleteGift(params.id), "Gift deleted successfully"), {
    admin: true,
    params: IdParam,
  });

export const giftTransactionsFeature = new Elysia({
  prefix: "/gift-transactions",
  name: "feature.gift-transactions",
  tags: ["Gifts"],
})
  .use(authPlugin)
  .get("/admin", async () => ok(await listGiftTransactions()), { admin: true })
  .put(
    "/admin/:id/status",
    async ({ params, body }) => ok(await updateGiftTransactionStatus(params.id, body.status), "Status updated"),
    { admin: true, params: IdParam, body: UpdateGiftTransactionStatus },
  );
