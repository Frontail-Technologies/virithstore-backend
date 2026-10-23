import { t, type Static } from "elysia";

export const SettingKeyParam = t.Object({ key: t.String({ minLength: 1, maxLength: 100 }) });

export const SetSetting = t.Object({ value: t.Any() });
export type SetSetting = Static<typeof SetSetting>;

// Free-form key -> value map; the service rejects non-objects because Elysia skips property-less schemas.
export const SetSettings = t.Object({}, { additionalProperties: t.Any() });
export type SetSettings = Record<string, unknown>;
