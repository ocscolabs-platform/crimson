const PRODUCTION_SITE_ORIGIN = "https://ocsco.io";

function parseSiteOrigin(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid http(s) site origin.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must contain only an http(s) site origin.");
  }

  return new URL(url.origin);
}

export function getSiteOrigin(): URL | undefined {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelEnvironment = process.env.VERCEL_ENV;

  if (configuredOrigin) {
    const siteOrigin = parseSiteOrigin(configuredOrigin);

    if (vercelEnvironment === "production" && siteOrigin.origin !== PRODUCTION_SITE_ORIGIN) {
      throw new Error(`Production NEXT_PUBLIC_SITE_URL must be ${PRODUCTION_SITE_ORIGIN}.`);
    }

    if (vercelEnvironment === "preview" && siteOrigin.origin === PRODUCTION_SITE_ORIGIN) {
      throw new Error("Preview NEXT_PUBLIC_SITE_URL must not point to the Production site.");
    }

    return siteOrigin;
  }

  if (vercelEnvironment === "production") {
    return new URL(PRODUCTION_SITE_ORIGIN);
  }

  if (vercelEnvironment === "preview") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for Vercel Preview deployments.");
  }

  // Local development may omit the variable; use a local-only origin rather
  // than allowing metadata to fall back to a remote Production domain.
  return new URL("http://localhost:3000");
}
