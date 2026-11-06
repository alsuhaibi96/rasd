import { getLang } from "@/lib/lang-server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  return <LoginForm lang={await getLang()} />;
}
