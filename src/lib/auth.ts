import { getToken, setToken, api } from "./api";
import { useSyncExternalStore, useMemo } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("hrms-auth-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("hrms-auth-change", cb);
    window.removeEventListener("storage", cb);
  };
}

export function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload)?.role ?? null;
  } catch (e) {
    return null;
  }
}

export function getEmailFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload)?.email ?? null;
  } catch (e) {
    return null;
  }
}

export function getPasswordResetRequiredFromToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return !!JSON.parse(jsonPayload)?.password_reset_required;
  } catch (e) {
    return false;
  }
}

export function useAuth() {
  const token = useSyncExternalStore(
    subscribe,
    () => getToken(),
    () => null,
  );

  const role = useMemo(() => getRoleFromToken(token), [token]);
  const email = useMemo(() => getEmailFromToken(token), [token]);
  const passwordResetRequired = useMemo(() => getPasswordResetRequiredFromToken(token), [token]);

  return { token, isAuthenticated: !!token, role, email, passwordResetRequired };
}

export type LoginResponse = {
  access_token?: string;
  token?: string;
  token_type?: string;
  [k: string]: unknown;
};

export async function login(email: string, password: string) {
  const res = await api<LoginResponse>("/login", {
    method: "POST",
    body: { email, password },
  });
  const token = res.access_token ?? res.token;
  if (!token) throw new Error("Login response missing token");
  setToken(token);
  return res;
}

export function logout() {
  setToken(null);
}

export { getToken };