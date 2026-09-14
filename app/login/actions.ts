"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authSecretReady,
  safeNextPath,
  secretsEqual,
  signSession,
} from "@/lib/auth";
import { hashPassword, normalizeEmail, validateEmail, verifyPassword } from "@/lib/password";
import { allowIp } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/staff";

export type AuthState = { error?: string; success?: string };

const DUMMY_HASH =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

async function startSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

function setupTokenOk(fd: FormData) {
  const expected = process.env.SETUP_TOKEN?.trim();
  if (process.env.NODE_ENV !== "production") return true;
  if (!expected) return false;
  const got = String(fd.get("setupToken") || "");
  return got.length === expected.length && secretsEqual(got, expected);
}

export async function setup(_prev: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await allowIp("setup", 5, 60 * 60 * 1000))) {
    return { error: "Too many setup attempts. Try again later." };
  }
  if ((await db.admin.count()) > 0) {
    return { error: "Staff login is already set up. Sign in instead." };
  }
  if (!authSecretReady()) {
    return { error: "Set AUTH_SECRET on the server before creating the staff login." };
  }
  if (!setupTokenOk(fd)) {
    return { error: "Set SETUP_TOKEN on the server and enter it here to create the first login." };
  }

  const email = normalizeEmail(fd.get("email"));
  const password = String(fd.get("password") || "");
  const confirm = String(fd.get("confirm") || "");

  if (!validateEmail(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  await db.admin.create({
    data: {
      id: "staff",
      email,
      passwordHash: await hashPassword(password),
    },
  });

  await startSession();
  redirect(safeNextPath(fd.get("next")));
}

export async function login(_prev: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await allowIp("login", 8, 15 * 60 * 1000))) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }
  if (!authSecretReady()) {
    return { error: "Server login is not configured. Set AUTH_SECRET." };
  }

  const email = normalizeEmail(fd.get("email"));
  const password = String(fd.get("password") || "");
  const admin = await db.admin.findUnique({ where: { email } });

  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    if (!admin) await verifyPassword(password, DUMMY_HASH);
    return { error: "Email or password is incorrect." };
  }

  await startSession();
  redirect(safeNextPath(fd.get("next")));
}

export async function updateStaff(_prev: AuthState, fd: FormData): Promise<AuthState> {
  await requireStaff();
  const admin = await db.admin.findUnique({ where: { id: "staff" } });
  if (!admin) redirect("/");

  const current = String(fd.get("current") || "");
  if (!(await verifyPassword(current, admin.passwordHash))) {
    return { error: "Current password is incorrect." };
  }

  const email = normalizeEmail(fd.get("email"));
  if (!validateEmail(email)) return { error: "Enter a valid email address." };

  const password = String(fd.get("password") || "");
  const confirm = String(fd.get("confirm") || "");
  if (password) {
    if (password.length < 8) return { error: "New password must be at least 8 characters." };
    if (password !== confirm) return { error: "New passwords do not match." };
  }

  await db.admin.update({
    where: { id: admin.id },
    data: {
      email,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  return { success: "Login email and password saved." };
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}
