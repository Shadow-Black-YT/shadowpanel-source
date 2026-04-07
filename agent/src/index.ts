/**
 * shadowPanel v1.0 — Node Agent
 * Runs on each VPS, manages Docker containers on behalf of the panel
 * Developed by Nystic.Shadow | Powered by shadowblack
 * Support: https://discord.gg/eezz8RAQ9c
 */
import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import Dockerode from 'dockerode'
import { execSync, exec as execCb } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const exec = promisify(execCb)
const app = express()
const docker = new Dockerode({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' })

const PORT = parseInt(process.env.AGENT_PORT || '8080')
const AGENT_SECRET = process.env.AGENT_SECRET || ''
const STORAGE_PATH = process.env.STORAGE_PATH || '/data/servers'
const BACKUP_PATH = process.env.BACKUP_PATH || '/data/backups'

app.use(express.json({ limit: '50mb' }))
app.set('trust proxy', true)

// ── Auth middleware ─────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') return next()
  const secret = req.headers['x-agent-secret']
  if (!AGENT_SECRET || secret !== AGENT_SECRET) {
    return res.status(403).json({ error: 'Forbidden', powered_by: 'shadowblack' })
  }
  next()
})

// ── Health ──────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await docker.ping()
    res.json({ status: 'ok', version: '1.0.0', powered_by: 'shadowblack', developed_by: 'Nystic.Shadow' })
  } catch {
    res.status(503).json({ status: 'degraded', docker: 'unavailable' })
  }
})

// ── Node info ───────────────────────────────────────────────────
app.get('/info', async (_req, res) => {
  const totalRam = Math.round(os.totalmem() / 1024 / 1024)
  const usedRam = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
  const cpuCount = os.cpus().length
  const loadAvg = os.loadavg()[0]

  let diskTotal = 0, diskUsed = 0
  try {
    const df = execSync("df -BM / | tail -1 | awk '{print $2,$3}'").toString().trim().split(' ')
    diskTotal = parseInt(df[0]) || 0
    diskUsed = parseInt(df[1]) || 0
  } catch { }

  const dockerInfo = await docker.info().catch(() => ({}) as any)
  const containers = await docker.listContainers({ all: true }).catch(() => [])
  const running = containers.filter((c: any) => c.State === 'running').length

  res.json({
    version: '1.0.0',
    totalRam,
    ramUsed: usedRam,
    freeRam: totalRam - usedRam,
    totalCpu: cpuCount * 100,
    cpuUsage: Math.min(Math.round((loadAvg / cpuCount) * 100), 100),
    totalDisk: diskTotal,
    diskUsed,
    diskFree: diskTotal - diskUsed,
    loadAvg,
    uptime: os.uptime(),
    dockerVersion: dockerInfo.ServerVersion || 'unknown',
    containersRunning: running,
    containersTotal: containers.length,
  })
})

// ── Networks ────────────────────────────────────────────────────
app.post('/networks', async (req, res) => {
  const { name } = req.body
  try {
    await docker.createNetwork({ Name: name, Driver: 'bridge', CheckDuplicate: true })
    res.json({ created: name })
  } catch (err: any) {
    if (err.statusCode === 409) res.json({ exists: name })
    else res.status(500).json({ error: err.message })
  }
})

app.delete('/networks/:name', async (req, res) => {
  try {
    const net = docker.getNetwork(req.params.name)
    await net.remove()
  } catch { }
  res.json({ deleted: req.params.name })
})

// ── Image pull ──────────────────────────────────────────────────
app.post('/images/pull', async (req, res) => {
  const { image } = req.body
  if (!image) { res.status(400).json({ error: 'image required' }); return }
  try {
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: any, stream: any) => {
        if (err) { reject(err); return }
        docker.modem.followProgress(stream, (err2: any) => err2 ? reject(err2) : resolve())
      })
    })
    res.json({ pulled: image })
  } catch (err: any) {
    res.status(500).json({ error: 'Pull failed: ' + err.message })
  }
})

// ── Git clone/pull ───────────────────────────────────────────────
app.post('/repo/clone', async (req, res) => {
  const { serverId, url, branch = 'main', token } = req.body

  if (/[;&|`$()<>\\]/.test(branch) || /[;&|`$()<>\\]/.test(url) || branch.includes('"') || url.includes('"')) {
    return res.status(400).json({ error: 'Invalid branch or URL characters' })
  }

  const dest = path.join(STORAGE_PATH, serverId)
  fs.mkdirSync(dest, { recursive: true })

  let repoUrl = url
  if (token && url.includes('github.com')) {
    repoUrl = url.replace('https://', `https://${token}@`)
  }

  try {
    if (fs.existsSync(path.join(dest, '.git'))) {
      await exec(`git -C "${dest}" pull --ff-only 2>&1`)
    } else {
      await exec(`git clone --depth 1 --branch "${branch}" "${repoUrl}" "${dest}" 2>&1`)
    }
    res.json({ cloned: serverId, path: dest })
  } catch (err: any) {
    res.status(500).json({ error: 'Git failed: ' + err.stderr || err.message })
  }
})

// ── Container: Create ───────────────────────────────────────────
app.post('/containers', async (req, res) => {
  const spec = req.body
  const serverDir = path.join(STORAGE_PATH, spec.serverId)
  fs.mkdirSync(serverDir, { recursive: true })
  fs.mkdirSync(BACKUP_PATH, { recursive: true })

  const env = Object.entries(spec.env || {}).map(([k, v]) => `${k}=${v}`)

  const portBindings: Record<string, any[]> = {}
  const exposedPorts: Record<string, {}> = {}
  for (const p of (spec.ports || [])) {
    if (p.external) {
      const key = `${p.internal}/${p.protocol || 'tcp'}`
      exposedPorts[key] = {}
      portBindings[key] = [{ HostPort: String(p.external) }]
    }
  }

  const binds: string[] = [`${serverDir}:/data`]
  for (const v of (spec.volumes || [])) {
    const b = `${v.host}:${v.container}${v.readonly ? ':ro' : ''}`
    if (!binds.includes(b)) binds.push(b)
  }

  try {
    const container = await docker.createContainer({
      name: spec.name,
      Image: spec.image,
      Cmd: spec.startup ? ['/bin/sh', '-c', spec.startup] : undefined,
      Env: env,
      ExposedPorts: exposedPorts,
      Labels: {
        'shadowpanel.server_id': spec.serverId,
        'shadowpanel.managed': 'true',
        'shadowpanel.version': '1.0.0',
        ...spec.labels,
      },
      HostConfig: {
        Memory: spec.memory || 512 * 1024 * 1024,
        MemorySwap: spec.memorySwap || spec.memory * 1.5 || 768 * 1024 * 1024,
        CpuQuota: spec.cpuQuota || 100000,
        CpuPeriod: spec.cpuPeriod || 100000,
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: spec.networkMode || 'bridge',
        RestartPolicy: spec.restartPolicy || { Name: 'unless-stopped' },
        CapDrop: spec.capDrop || ['ALL'],
        CapAdd: spec.capAdd || ['CHOWN', 'SETUID', 'SETGID', 'NET_BIND_SERVICE'],
        SecurityOpt: spec.securityOpt || ['no-new-privileges:true'],
        Ulimits: [{ Name: 'nofile', Soft: 65536, Hard: 65536 }],
      } as any,
    })
    res.json({ containerId: container.id })
  } catch (err: any) {
    res.status(500).json({ error: 'Create failed: ' + err.message })
  }
})

app.post('/containers/:id/start', async (req, res) => {
  try {
    await docker.getContainer(req.params.id).start()
    res.json({ started: req.params.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Container: Power ────────────────────────────────────────────
app.post('/containers/:id/power', async (req, res) => {
  const { action } = req.body
  const c = docker.getContainer(req.params.id)
  try {
    if (action === 'start') await c.start()
    else if (action === 'stop') await c.stop({ t: 10 })
    else if (action === 'restart') await c.restart({ t: 10 })
    else if (action === 'kill') await c.kill()
    res.json({ action, id: req.params.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Container: Delete ───────────────────────────────────────────
app.delete('/containers/:id', async (req, res) => {
  const { deleteFiles } = req.body || {}
  const c = docker.getContainer(req.params.id)
  try { await c.stop({ t: 5 }).catch(() => { }) } catch { }
  try { await c.remove({ v: true, force: true }) } catch { }

  if (deleteFiles) {
    try {
      const info = await docker.getContainer(req.params.id).inspect().catch(() => null) as any
      const serverId = info?.Config?.Labels?.['shadowpanel.server_id']
      if (serverId) {
        const dir = path.join(STORAGE_PATH, serverId)
        fs.rmSync(dir, { recursive: true, force: true })
      }
    } catch { }
  }
  res.json({ deleted: req.params.id })
})

// ── Container: Logs ─────────────────────────────────────────────
app.get('/containers/:id/logs', async (req, res) => {
  const lines = parseInt(req.query.lines as string || '100')
  const c = docker.getContainer(req.params.id)
  try {
    const buffer = await c.logs({ stdout: true, stderr: true, tail: lines }) as any
    const raw: string = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer)
    const logs = raw.split('\n').map(line => {
      const firstByte = line.charCodeAt(0)
      return (firstByte === 1 || firstByte === 2) && line.length > 8 ? line.slice(8) : line
    }).filter(Boolean)
    res.json({ logs })
  } catch {
    res.json({ logs: ['Container not running or logs unavailable'] })
  }
})

app.get('/containers/:id/logs/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  const c = docker.getContainer(req.params.id)
  try {
    const stream = await c.logs({ stdout: true, stderr: true, follow: true, tail: 50 }) as any
    stream.pipe(res)
    req.on('close', () => stream.destroy())
  } catch {
    res.end()
  }
})

// ── Container: Exec ─────────────────────────────────────────────
app.post('/containers/:id/exec', async (req, res) => {
  const { command } = req.body
  const c = docker.getContainer(req.params.id)
  try {
    const execInst = await c.exec({ Cmd: ['/bin/sh', '-c', command], AttachStdout: true, AttachStderr: true })
    const stream = await execInst.start({ hijack: true, stdin: false })
    let output = ''
    stream.on('data', (chunk: Buffer) => {
      const str = chunk.length > 8 ? chunk.slice(8).toString('utf8') : chunk.toString('utf8')
      output += str
    })
    stream.on('end', () => res.json({ output: output.trim() }))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/containers/:id/exec/interactive', async (req, res) => {
  const { cols = 80, rows = 24 } = req.body
  const c = docker.getContainer(req.params.id)
  try {
    const execInst = await c.exec({
      Cmd: ['/bin/bash'], Tty: true,
      AttachStdin: true, AttachStdout: true, AttachStderr: true,
    })
    const stream = await execInst.start({ hijack: true, stdin: true })
    await execInst.resize({ w: cols, h: rows }).catch(() => { })
    res.setHeader('Content-Type', 'application/octet-stream')
    stream.pipe(res)
    req.pipe(stream)
    req.on('close', () => stream.destroy())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Container: Stats ────────────────────────────────────────────
app.get('/containers/:id/stats', async (req, res) => {
  const c = docker.getContainer(req.params.id)
  try {
    const rawStats = await c.stats({ stream: false }) as any
    const cpuDelta = rawStats.cpu_stats.cpu_usage.total_usage - rawStats.precpu_stats.cpu_usage.total_usage
    const sysDelta = rawStats.cpu_stats.system_cpu_usage - rawStats.precpu_stats.system_cpu_usage
    const numCpus = rawStats.cpu_stats.online_cpus || 1
    const cpu = sysDelta > 0 ? Math.min(parseFloat(((cpuDelta / sysDelta) * numCpus * 100).toFixed(2)), 100) : 0
    const ram = Math.round((rawStats.memory_stats.usage || 0) / 1024 / 1024)
    const netRx = Object.values(rawStats.networks || {}).reduce((a: number, n: any) => a + (n.rx_bytes || 0), 0)
    const netTx = Object.values(rawStats.networks || {}).reduce((a: number, n: any) => a + (n.tx_bytes || 0), 0)
    const blk = rawStats.blkio_stats?.io_service_bytes_recursive || []
    const disk = Math.round(blk.filter((b: any) => b.op === 'Read').reduce((a: number, b: any) => a + b.value, 0) / 1024 / 1024)
    res.json({ cpu, ram, disk, netRx: Number(netRx), netTx: Number(netTx) })
  } catch {
    res.json({ cpu: 0, ram: 0, disk: 0, netRx: 0, netTx: 0 })
  }
})

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════')
  console.log('  🌑 shadowPanel Agent v1.0')
  console.log('  Developed by Nystic.Shadow')
  console.log('  Powered by shadowblack')
  console.log('  Listening on :' + PORT)
  console.log('  Docker: ' + (process.env.DOCKER_SOCKET || '/var/run/docker.sock'))
  console.log('═══════════════════════════════════════════')
})
