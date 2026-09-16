const BASE_URL = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:8000"
  : "https://hrms-2-t02s.onrender.com";
const TOKEN_KEY = "hrms_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("hrms-auth-change"));
}

type RequestOpts = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let url = `${BASE_URL}${path}`;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const res = await fetch(url, { method: opts.method ?? "GET", headers, body });
  const ct = res.headers.get("content-type") ?? "";
  const payload = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    let msg = "Request failed";
    if (payload && typeof payload === "object" && "detail" in (payload as any)) {
      const detail = (payload as any).detail;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail
          .map((d: any) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "Field";
            const cleanField = String(field)
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            return `${cleanField}: ${d.msg}`;
          })
          .join(" | ");
      } else {
        msg = JSON.stringify(detail);
      }
    } else if (typeof payload === "string") {
      msg = payload;
    } else {
      msg = res.statusText;
    }
    throw new ApiError(res.status, msg, payload);
  }
  return payload as T;
}

export type AiActionCard = {
  action_required: "confirmation";
  action_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  num_days: number;
  reason: string;
  message: string;
};

export type AiMessage = {
  id: string;
  sender: "user" | "assistant" | "system";
  content: string;
  created_at: string | null;
  action_card?: AiActionCard | null;
};

export type AiChatResponse = {
  conversation_id: string;
  response: string;
  action_card?: AiActionCard | null;
};

export type AiConversation = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
};

export async function sendAiMessage(message: string, conversationId?: string): Promise<AiChatResponse> {
  return api<AiChatResponse>("/ai/chat", {
    method: "POST",
    body: { message, conversation_id: conversationId },
  });
}

export async function confirmAiAction(actionId: string, confirm: boolean): Promise<{ status: string; message: string; leave_id?: string }> {
  return api("/ai/confirm-action", {
    method: "POST",
    body: { action_id: actionId, confirm },
  });
}

export async function getAiConversations(): Promise<AiConversation[]> {
  return api<AiConversation[]>("/ai/conversations");
}

export async function getAiMessages(conversationId: string): Promise<{ conversation_id: string; messages: AiMessage[] }> {
  return api(`/ai/conversations/${conversationId}/messages`);
}