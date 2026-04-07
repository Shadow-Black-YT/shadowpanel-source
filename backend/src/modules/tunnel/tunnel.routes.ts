import { Router } from 'express';
import { query, queryOne } from '../../database';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);
export const tunnelRouter = Router();
const URL_FILE = path.join(process.env.INSTALL_DIR||'/opt/shadowpanel','.tunnel-url');

tunnelRouter.get('/status', async (_req,res) => {
  let tunnelUrl = process.env.TUNNEL_URL || '';
  if (fs.existsSync(URL_FILE)) tunnelUrl = fs.readFileSync(URL_FILE,'utf-8').trim();

  let currentIPv4 = process.env.PUBLIC_IPV4 || '';
  try {
    const r = await axios.get('https://api4.ipify.org',{timeout:3000});
    if (/^\d+\.\d+\.\d+\.\d+$/.test(r.data?.trim())) currentIPv4 = r.data.trim();
  } catch {}

  let tunnelActive = false;
  if (process.env.ACCESS_METHOD==='tunnel') {
    try {
      const {stdout} = await execAsync('systemctl is-active shadowpanel-tunnel 2>/dev/null||echo inactive');
      tunnelActive = stdout.trim()==='active';
    } catch {}
  }

  res.json({
    accessMethod: process.env.ACCESS_METHOD||'direct',
    publicIPv4: currentIPv4,
    publicIPv6: process.env.PUBLIC_IPV6||'',
    tunnelUrl,
    tunnelActive,
    tunnelType: fs.existsSync(path.join(process.env.INSTALL_DIR||'/opt/shadowpanel','.cf-tunnel-id')) ? 'named' : 'quick',
    panelUrl: process.env.PANEL_URL||('http://'+(currentIPv4||'localhost')),
  });
});

tunnelRouter.post('/url', async (req,res) => {
  const { url } = req.body;
  if (!url) { res.status(400).json({error:'URL required'}); return; }
  fs.mkdirSync(path.dirname(URL_FILE),{recursive:true});
  fs.writeFileSync(URL_FILE,url);
  await query(`INSERT INTO settings(key,value,updated_at) VALUES('tunnel.url',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=NOW()`,[url]).catch(()=>{});
  res.json({ message:'Tunnel URL updated', url });
});

tunnelRouter.get('/logs', async (_req,res) => {
  const logFile = '/opt/shadowpanel/tunnel.log';
  const lines = fs.existsSync(logFile)
    ? fs.readFileSync(logFile,'utf-8').split('\n').filter(Boolean).slice(-100)
    : ['No tunnel logs found'];
  res.json({ lines });
});
