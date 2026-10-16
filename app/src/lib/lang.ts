import "server-only";
import { cookies } from "next/headers";
import { DICTS, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "es" ? "es" : "ca";
}

export async function getDict() {
  return DICTS[await getLang()];
}
