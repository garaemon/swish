import os from 'node:os'
import type { NextConfig } from 'next'

// Next.js 16 blocks cross-origin dev-server requests (HMR / RSC) unless the
// host is allow-listed. Derive the LAN-reachable hostname at config load
// time so contributors do not have to edit this file when their machine
// hostname differs. Includes both the bare hostname and its .local mDNS
// alias so either works.
function lanDevOrigins(): string[] {
  const hostname = os.hostname()
  if (!hostname || hostname === 'localhost') return []
  const bare = hostname.replace(/\.local$/, '')
  return [bare, `${bare}.local`]
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
}

export default nextConfig
