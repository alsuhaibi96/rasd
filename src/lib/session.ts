import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./auth";

export async function currentUser() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
