"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/auth";

export function useCurrentRole() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setRole(data.role || null))
      .catch(() => setRole(null));
  }, []);

  return role;
}