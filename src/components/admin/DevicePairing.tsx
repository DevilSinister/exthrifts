"use client";

// Pairs the Android order-alert app with the signed-in admin. The app opens
// the admin as https://<site>/admin#device=<FCM token>; the fragment never
// reaches the server or its logs. We read it, POST it with the session cookie,
// and clear it from the address bar.
import { useEffect, useState } from "react";

const STASH_KEY = "ext_device_token";

function hashParam(name: string): string | null {
  const match = window.location.hash.match(new RegExp(`(?:^#|&)${name}=([^&]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function tokenFromHash(): string | null {
  const token = hashParam("device");
  return token && token.length >= 20 && token.length <= 512 ? token : null;
}

/** The app also sends the phone model (Build.MODEL) so the Devices page names it. */
function labelFromHash(): string | null {
  return hashParam("label")?.slice(0, 80) ?? null;
}

function clearHash() {
  const url = window.location.pathname + window.location.search;
  window.history.replaceState(window.history.state, "", url);
}

/** Login page: keep the token until the session exists. */
export function stashDeviceTokenFromHash() {
  const token = tokenFromHash();
  if (!token) return;
  try {
    window.sessionStorage.setItem(STASH_KEY, token);
    const label = labelFromHash();
    if (label) window.sessionStorage.setItem(`${STASH_KEY}_label`, label);
  } catch {
    /* storage blocked: the app re-sends the token on its next launch */
  }
  clearHash();
}

export function DevicePairing() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let token = tokenFromHash();
    let label = labelFromHash();
    if (token) clearHash();
    if (!token) {
      try {
        token = window.sessionStorage.getItem(STASH_KEY);
        label = window.sessionStorage.getItem(`${STASH_KEY}_label`);
      } catch {
        token = null;
      }
    }
    if (!token) return;
    label ??= /Android/i.test(navigator.userAgent) ? "Android phone" : "This device";
    fetch("/api/admin/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, label }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { created?: boolean };
        try {
          window.sessionStorage.removeItem(STASH_KEY);
          window.sessionStorage.removeItem(`${STASH_KEY}_label`);
        } catch {
          /* ignore */
        }
        // Only announce a new pairing; re-launches refresh silently.
        if (body.created) setMessage("This phone will now get an alert for every new order.");
      })
      .catch(() => setMessage("Couldn't turn on order alerts for this phone. Close and reopen the app to try again."));
  }, []);

  if (!message) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-start gap-3 border-2 border-ink bg-card p-3 shadow-[4px_5px_0_rgba(13,13,12,0.9)] md:bottom-6">
      <p className="flex-1 text-sm">{message}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMessage(null)}>
        OK
      </button>
    </div>
  );
}
