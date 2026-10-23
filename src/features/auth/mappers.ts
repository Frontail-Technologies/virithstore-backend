import type { User } from "../../db/schema/users";

/** What login/register/oauth return to the client: no password hash, OTP or internal flags. */
export function toAuthUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    telegramId: user.telegramId,
    role: user.role,
    image: user.image,
    referralCode: user.referralCode,
    walletPoints: user.walletPoints,
  };
}

/** Profile returned by `GET /auth/me`. */
export function toSessionUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
    telegramId: user.telegramId,
    authProvider: user.authProvider,
    isVerified: user.isVerified,
  };
}
