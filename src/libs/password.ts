/** Native, off-event-loop bcrypt. Verifies existing `$2a$/$2b$` hashes written by bcryptjs. */
export const hashPassword = (password: string) => Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });

export const verifyPassword = (password: string, hash: string) => Bun.password.verify(password, hash);
