import { cookies } from "next/headers";

export type Lang = "ar" | "en";
export async function getLang(): Promise<Lang> {
  return (await cookies()).get("rasd_lang")?.value === "en" ? "en" : "ar";
}
