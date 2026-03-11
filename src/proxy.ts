import { type NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "mossc_auth";

const encoder = new TextEncoder();

const hexToUint8Array = (hex: string): Uint8Array<ArrayBuffer> => {
  if (hex.length % 2 !== 0) return new Uint8Array(new ArrayBuffer(0));
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

/**
 * Verifies the session cookie using Web Crypto HMAC-SHA256 (edge-compatible).
 * Uses crypto.subtle.verify which is inherently timing-safe.
 */
const verifySessionCookie = async (
  cookieValue: string,
  password: string
): Promise<boolean> => {
  try {
    const tokenBytes = hexToUint8Array(cookieValue);
    if (tokenBytes.length === 0) return false;
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return crypto.subtle.verify(
      "HMAC",
      keyMaterial,
      tokenBytes,
      encoder.encode("mossc_session_v1")
    );
  } catch {
    return false;
  }
};

export async function proxy(request: NextRequest) {
  const password = process.env.MOSSC_PASSWORD?.trim();

  // Auth is disabled — allow all requests through.
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Always allow the login page and the auth API routes.
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const isValid = await verifySessionCookie(cookieValue, password);

  if (!isValid) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the original destination so we can redirect back after login.
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico / public assets (mossclogo.png, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
