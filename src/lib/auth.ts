import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "./store";
import type { SessionUser, UserRole } from "./types";

const COOKIE_NAME = "mg_energia_session";
const SESSION_DAYS = 7;

function secret() {
  return process.env.AUTH_SECRET || "local-dev-secret-change-before-production";
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string) {
  const actual = Buffer.from(sign(payload));
  const expected = Buffer.from(signature);

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function createSessionToken(userId: string) {
  const payload = base64Url(
    JSON.stringify({
      userId,
      exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
    })
  );

  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId: string;
      exp: number;
    };

    if (!session.userId || session.exp < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = parseSessionToken(token);

  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sourceId: user.sourceId
  };
}

export async function requireUser(roles?: UserRole[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (roles && !roles.includes(user.role)) {
    redirect("/dashboard?type=error&message=Accesso%20non%20autorizzato.");
  }

  return user;
}

export function canManageAll(user: SessionUser) {
  return user.role === "admin" || user.role === "frontline";
}
