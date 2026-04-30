import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ success: true });
  // Properly delete the session cookie
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
