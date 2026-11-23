import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type BillingKv = {
  put: (key: string, value: string) => Promise<void>;
};

function getRuntimeBinding(env: unknown, name: string) {
  if (env && typeof env === "object") {
    const binding = (env as Record<string, unknown>)[name];
    if (binding !== undefined) return binding;
  }
  const processEnvironment = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return processEnvironment?.[name];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createDevSessionToken(secret: string, expiresAt: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = String(expiresAt);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${bytesToHex(new Uint8Array(signature))}`;
}

async function isValidDevSession(request: Request, secret: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("posto10-dev-session="))
    ?.slice("posto10-dev-session=".length);
  const [expiresAtText, signatureHex] = token?.split(".") ?? [];
  const expiresAt = Number(expiresAtText);
  if (!signatureHex || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (!/^[\da-f]{64}$/i.test(signatureHex)) return false;
  const signature = new Uint8Array(
    signatureHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(expiresAtText ?? ""),
  );
}

async function handleDeveloperAuth(request: Request, env: unknown) {
  const url = new URL(request.url);
  const configuredEmail = getRuntimeBinding(env, "ADMIN_DEV_EMAIL");
  const configuredPassword = getRuntimeBinding(env, "ADMIN_DEV_PASSWORD");
  const configuredSecret = getRuntimeBinding(env, "ADMIN_DEV_SESSION_SECRET");
  if (
    import.meta.env.PROD &&
    (typeof configuredEmail !== "string" ||
      typeof configuredPassword !== "string" ||
      typeof configuredSecret !== "string" ||
      configuredSecret.length < 32 ||
      configuredSecret === "REPLACE_WITH_A_RANDOM_SECRET")
  ) {
    return jsonResponse(
      { error: "CREDENCIAIS E SEGREDO DO ADMIN DEV PRECISAM SER CONFIGURADOS." },
      503,
    );
  }
  const email = configuredEmail ?? "dev@posto10.com.br";
  const password = configuredPassword ?? "Admin123";
  const sessionSecret = configuredSecret ?? password;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof sessionSecret !== "string"
  ) {
    return jsonResponse({ error: "CONFIGURAÇÃO DO ADMINISTRADOR INVÁLIDA." }, 500);
  }
  if (url.pathname === "/api/admin-dev/session" && request.method === "GET") {
    return (await isValidDevSession(request, sessionSecret))
      ? jsonResponse({ authenticated: true })
      : jsonResponse({ authenticated: false }, 401);
  }
  if (url.pathname === "/api/admin-dev/logout" && request.method === "POST") {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": "posto10-dev-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  }
  if (url.pathname !== "/api/admin-dev/login" || request.method !== "POST") {
    return jsonResponse({ error: "MÉTODO NÃO PERMITIDO." }, 405);
  }
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== url.host) {
    return jsonResponse({ error: "ORIGEM INVÁLIDA." }, 403);
  }
  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = (await request.json()) as typeof credentials;
  } catch {
    return jsonResponse({ error: "CORPO JSON INVÁLIDO." }, 400);
  }
  if (
    typeof credentials.email !== "string" ||
    typeof credentials.password !== "string" ||
    credentials.email.trim().toLocaleLowerCase("pt-BR") !== email.toLocaleLowerCase("pt-BR") ||
    credentials.password.toLocaleUpperCase("pt-BR") !== password.toLocaleUpperCase("pt-BR")
  ) {
    return jsonResponse({ error: "E-MAIL OU SENHA INVÁLIDOS." }, 401);
  }
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const token = await createDevSessionToken(sessionSecret, expiresAt);
  const secure = url.protocol === "https:" ? " Secure;" : "";
  return new Response(JSON.stringify({ authenticated: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `posto10-dev-session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800;${secure}`,
    },
  });
}

async function handleBillingRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname === "/api/asaas/config" && request.method === "GET") {
    const apiKey = getRuntimeBinding(env, "ASAAS_API_KEY");
    const configured = typeof apiKey === "string" && apiKey.length > 0;
    return jsonResponse({
      mode: configured ? "ASAAS_CONFIGURADO" : "DEMO",
      environment: getRuntimeBinding(env, "ASAAS_ENV") === "production" ? "PRODUÇÃO" : "SANDBOX",
      checkoutReady: false,
      message: configured
        ? "O ASAAS TEM CHAVE CONFIGURADA, MAS FALTA PERSISTÊNCIA CENTRAL E PROVISIONAMENTO."
        : "MODO DEMO: PAGAMENTOS NÃO SÃO COBRADOS.",
    });
  }
  if (url.pathname !== "/webhook-asaas") return null;
  if (request.method !== "POST") return jsonResponse({ error: "MÉTODO NÃO PERMITIDO." }, 405);

  const expectedToken = getRuntimeBinding(env, "ASAAS_WEBHOOK_TOKEN");
  const providedToken =
    request.headers.get("asaas-access-token") ?? request.headers.get("x-asaas-token");
  if (typeof expectedToken !== "string" || expectedToken.length === 0) {
    return jsonResponse({ error: "WEBHOOK ASAAS NÃO CONFIGURADO." }, 503);
  }
  if (!providedToken || providedToken !== expectedToken) {
    return jsonResponse({ error: "TOKEN DO WEBHOOK INVÁLIDO." }, 401);
  }

  const text = await request.text();
  if (text.length > 1_000_000) return jsonResponse({ error: "EVENTO MUITO GRANDE." }, 413);
  let event: {
    id?: unknown;
    event?: unknown;
    payment?: { id?: unknown; externalReference?: unknown };
  };
  try {
    event = JSON.parse(text) as typeof event;
  } catch {
    return jsonResponse({ error: "CORPO JSON INVÁLIDO." }, 400);
  }
  const supportedEvents = new Set([
    "PAYMENT_CONFIRMED",
    "PAYMENT_OVERDUE",
    "SUBSCRIPTION_DELETED",
    "SUBSCRIPTION_INACTIVATED",
  ]);
  if (typeof event.event !== "string" || !supportedEvents.has(event.event)) {
    return jsonResponse({ error: "EVENTO ASAAS NÃO SUPORTADO." }, 400);
  }

  const storage = getRuntimeBinding(env, "POSTO10_BILLING_KV") as BillingKv | undefined;
  if (!storage || typeof storage.put !== "function") {
    return jsonResponse(
      { error: "PERSISTÊNCIA DE COBRANÇA NÃO CONFIGURADA; NENHUMA CONTA FOI ALTERADA." },
      503,
    );
  }
  const eventId =
    typeof event.id === "string"
      ? event.id
      : typeof event.payment?.id === "string"
        ? event.payment.id
        : crypto.randomUUID();
  await storage.put(`asaas-webhook-unprocessed:${eventId}`, text);
  return jsonResponse(
    {
      error:
        "EVENTO ARMAZENADO PARA CONCILIAÇÃO, MAS A LIBERAÇÃO AUTOMÁTICA NÃO ESTÁ ATIVA SEM BANCO CENTRAL E PROVISIONAMENTO.",
    },
    503,
  );
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin-dev/")) {
      try {
        return await handleDeveloperAuth(request, env);
      } catch (error) {
        console.error("FALHA NA AUTENTICAÇÃO DO ADMINISTRADOR.", error);
        return jsonResponse({ error: "FALHA NA AUTENTICAÇÃO DO ADMINISTRADOR." }, 500);
      }
    }
    if (url.pathname === "/webhook-asaas" || url.pathname === "/api/asaas/config") {
      try {
        const billingResponse = await handleBillingRequest(request, env);
        if (billingResponse) return billingResponse;
      } catch (error) {
        console.error("FALHA AO PROCESSAR INTEGRAÇÃO ASAAS.", error);
        return jsonResponse({ error: "FALHA AO PROCESSAR EVENTO ASAAS." }, 500);
      }
    }
    const hostname = url.hostname.toLowerCase();
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost");
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    const cloudflareVisitor = request.headers.get("cf-visitor") ?? "";
    const proxyUsesHttps =
      forwardedProtocol === "https" || /"scheme"\s*:\s*"https"/i.test(cloudflareVisitor);

    if (import.meta.env.PROD && url.protocol === "http:" && !isLocalHost && !proxyUsesHttps) {
      url.protocol = "https:";
      if (url.port === "80") url.port = "";
      return Response.redirect(url.toString(), 308);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
