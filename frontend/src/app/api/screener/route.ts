import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

function runPython(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    // Try python3 first, then python (Windows often uses 'python')
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3'
    const altCmd = process.platform === 'win32' ? 'python3' : 'python'

    const scriptPath = path.join(process.cwd(), '..', 'backend', 'scripts', 'filter_stocks.py')

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
  // Defaults based on your conditions
  const { searchParams } = new URL(req.url)
  const cmpMin = searchParams.get('cmpMin') ?? '200'
  const cmpMax = searchParams.get('cmpMax') ?? '5000'
  const chgMin = searchParams.get('chgMin') ?? '-5'
  const chgMax = searchParams.get('chgMax') ?? '10'
  const demand = searchParams.get('demand') ?? 'hot' // 'hot' or 'any'
  const limit = searchParams.get('limit') ?? '200'
  // Optional explicit column mappings
  const cmpCol = searchParams.get('cmpCol')
  const chgCol = searchParams.get('chgCol')
  const demandCol = searchParams.get('demandCol')
  const debug = searchParams.get('debug')

  const csvPath = path.join(process.cwd(), '..', 'backend', 'data', 'Stocks.csv')
  const args = [
    '--csv', csvPath,
    '--cmp-min', String(cmpMin),
    '--cmp-max', String(cmpMax),
    '--chg-min', String(chgMin),
    '--chg-max', String(chgMax),
    '--limit', String(limit),
  ]
  if (demand === 'hot') args.push('--demand-hot')
  if (cmpCol) { args.push('--cmp-col', cmpCol) }
  if (chgCol) { args.push('--chg-col', chgCol) }
  if (demandCol) { args.push('--demand-col', demandCol) }
  if (demand && demand !== 'any') { args.push('--demand', demand) }
  if (debug === '1' || debug === 'true') { args.push('--debug') }

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
    return NextResponse.json(parsed, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid script output', detail: String(e), raw: stdout }, { status: 500 })
  }
}
