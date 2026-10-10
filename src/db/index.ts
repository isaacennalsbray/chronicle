import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(url, { schema });
}

let instance: ReturnType<typeof connect> | undefined;

// Connect on first use so builds and scripts can import this without a database URL.
export const db = new Proxy({} as ReturnType<typeof connect>, {
  get(_, prop) {
    instance ??= connect();
    return Reflect.get(instance, prop, instance);
  },
});

export { schema };
