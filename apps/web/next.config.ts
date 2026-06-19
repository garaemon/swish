import os from 'node:os';
import type { NextConfig } from 'next';

// Next.js 16 blocks cross-origin dev-server requests (HMR / RSC) unless the
// host is allow-listed. Derive the LAN-reachable hostname at config load
// time so contributors do not have to edit this file when their machine
// hostname differs. Includes both the bare hostname and its .local mDNS
// alias so either works.
function lanDevOrigins(): string[] {
  const hostname = os.hostname();
  if (!hostname || hostname === 'localhost') {
    return [];
  }
  // Accept both the bare hostname (e.g. "ax8-max") and its mDNS alias
  // ("ax8-max.local"). For multi-label FQDNs (e.g. "host.corp.example.com")
  // the strip is a no-op so we only emit the original hostname and a
  // ".local" sibling — extra noise but harmless because the allow-list is
  // hostname-keyed.
  const bare = hostname.replace(/\.local$/, '');
  return [bare, `${bare}.local`];
}

// Devices on the same LAN often reach the dev server by raw IPv4 address
// rather than the mDNS hostname (e.g. Android, which lacks reliable mDNS).
// Allow-list every non-internal IPv4 the machine exposes so those origins
// are not blocked by Next's cross-origin dev guard.
function lanDevIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lanDevOrigins(), ...lanDevIpAddresses()],
};

export default nextConfig;
