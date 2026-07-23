import { redirect } from "next/navigation";
import { isPersonalMode } from "@/lib/personal-mode";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  if (isPersonalMode()) {
    redirect("/");
  }
  return <LoginForm />;
}
