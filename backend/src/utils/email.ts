import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailOpts {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: EmailOpts): Promise<void> {
  if (process.env.SMTP_ENABLED !== 'true') {
    logger.debug('Email skipped (SMTP disabled): ' + opts.subject);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@shadowpanel.local',
    ...opts,
  });
  logger.debug('Email sent: ' + opts.subject + ' → ' + opts.to);
}

export function emailHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#020209;font-family:system-ui,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#0a0a18;border:1px solid rgba(0,212,255,0.2);border-radius:16px;overflow:hidden">
  <div style="padding:24px 28px;background:linear-gradient(135deg,rgba(0,212,255,0.1),rgba(121,40,202,0.1));border-bottom:1px solid rgba(0,212,255,0.15)">
    <h1 style="margin:0;font-size:22px;font-weight:900;color:#e8e8ff">shadow<span style="background:linear-gradient(135deg,#00d4ff,#7928ca);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Panel</span></h1>
    <p style="margin:4px 0 0;font-size:11px;color:#4a4a6a;letter-spacing:0.1em;text-transform:uppercase">Powered by shadowblack</p>
  </div>
  <div style="padding:28px">
    <h2 style="margin:0 0 16px;color:#e8e8ff;font-size:18px">${title}</h2>
    ${body}
  </div>
  <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="margin:0;font-size:11px;color:#4a4a6a">Developed by <a href="https://discord.gg/eezz8RAQ9c" style="color:#00d4ff;text-decoration:none">Nystic.Shadow</a> · <a href="https://discord.gg/eezz8RAQ9c" style="color:#4a4a6a;text-decoration:none">Discord Support</a></p>
  </div>
</div></body></html>`;
}
