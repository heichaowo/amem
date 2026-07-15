/**
 * One definition of "does this address leave the machine", shared by the
 * server (which decides whether it may bind without a token) and the MCP bridge
 * (which decides whether it may send memories to it). The two halves must agree
 * on where the boundary is, so they read it from the same place.
 */

/** 127.0.0.0/8, ::1, and the name that resolves to them. `0.0.0.0` / `::` are
 * *not* loopback — they bind every interface, which is the whole point of the check. */
export function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '::1' || /^127\./.test(hostname)
}

/**
 * Refuse to expose an unauthenticated memory service to the network. Binding a
 * non-loopback host with no token would put every stored memory one request
 * away from anyone who can reach the port — so that combination does not start.
 */
export function assertBindable(host: string, token: string | undefined): void {
  if (!isLoopback(host) && !token) {
    throw new Error(
      `Refusing to bind ${host} without AMEM_API_TOKEN: that exposes an unauthenticated ` +
        `memory service to the network. Set AMEM_API_TOKEN, or bind a loopback address.`
    )
  }
}
