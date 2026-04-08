import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
  if (!key) {
    // Silently skip in environments without a key (e.g. local dev without .env)
    return;
  }
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: false,
      },
    },
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        // Don't spam the prod project with dev traffic unless explicitly desired.
        ph.opt_out_capturing();
      }
    },
  });
  initialized = true;
}

interface IdentifyUser {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  isSuperAdmin: boolean;
  role: { id: string; name: string };
}

export function identifyUser(user: IdentifyUser) {
  if (!initialized) return;
  posthog.identify(user.id, {
    username: user.username,
    name: user.fullName,
    email: user.email,
    is_super_admin: user.isSuperAdmin,
    role_id: user.role.id,
    role_name: user.role.name,
  });
}

export function resetPostHog() {
  if (!initialized) return;
  posthog.reset();
}

export function capture(event: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export { posthog };
