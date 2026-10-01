import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth";

export default function Home() {
  const role = getCurrentRole();
  if (!role) redirect("/admin/login");
  redirect(role === "SCANNER" ? "/scanner" : "/admin/dashboard");
}

