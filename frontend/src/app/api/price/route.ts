import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Simple in-memory cache with TTL
type CacheEntry = { data: any; expiresAt: number }
const cache: Map<string, CacheEntry> = new Map()
const TTL_MS = 10 * 60 * 1000 // 10 minutes

function runPython(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3'
    const altCmd = process.platform === 'win32' ? 'python3' : 'python'

    const scriptPath = path.join(process.cwd(), '..', 'backend', 'scripts', 'fetch_price.py')

    const trySpawn = (cmd: string) => spawn(cmd, [scriptPath, ...args], { cwd: process.cwd() })

    let proc = trySpawn(pyCmd)
    let usedAlt = false

    const done = (code: number, stdout: string, stderr: string) => resolve({ code, stdout, stderr })

    let stdout = ''
    let stderr = ''

    const attach = (p: ReturnType<typeof spawn>) => {
      p.stdout?.on('data', (d) => (stdout += d.toString()))
      p.stderr?.on('data', (d) => (stderr += d.toString()))
      p.on('error', () => {
        if (!usedAlt) {
          usedAlt = true
          proc = trySpawn(altCmd)
          attach(proc)
        } else {
          done(1, stdout, stderr || 'Failed to start python process')
        }
      })
      p.on('close', (code) => done(code ?? 1, stdout, stderr))
    }

    attach(proc)
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
  const days = searchParams.get('days') ?? '365'
  const interval = searchParams.get('interval') ?? '1d'

  const key = `${symbol}|${days}|${interval}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ ...hit.data, cached: true })
  }

  const args = ['--symbol', symbol, '--days', String(days), '--interval', String(interval)]
  const { code, stdout, stderr } = await runPython(args)
  if (code !== 0) {
    let msg = stderr
    try {
      const parsed = JSON.parse(stdout)
      msg = parsed.error || msg
    } catch {}
    return NextResponse.json({ error: msg || 'Script failed' }, { status: 500 })
  }
  try {
    const parsed = JSON.parse(stdout)
    cache.set(key, { data: parsed, expiresAt: Date.now() + TTL_MS })
    return NextResponse.json({ ...parsed, cached: false })
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid script output', detail: String(e), raw: stdout }, { status: 500 })
  }
}
