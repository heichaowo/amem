#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './mcp.js'

// Under stdio, stdout IS the protocol channel — a stray line written there
// corrupts the stream and the client drops the connection. So diagnostics go to
// stderr, and nothing in this entrypoint imports the engine (which logs on load).
const server = createMcpServer()

await server.connect(new StdioServerTransport())

process.stderr.write(`amem MCP server ready (amem-api: ${process.env.AMEM_API_URL ?? 'http://127.0.0.1:7788'})\n`)
