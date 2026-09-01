import type { VercelRequest, VercelResponse } from '@vercel/node';

function privateHost(hostname: string) {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '::1' || h.startsWith('10.') || h.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) || h === '0.0.0.0';
}

function cleanPhone(v: string) { return v.replace(/[^\d+]/g, '').replace(/^00/, '+'); }
function domainOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });
  const ownerKey = String(req.headers['x-owner-key'] || '');
  if (!process.env.OWNER_ADMIN_KEY || ownerKey !== process.env.OWNER_ADMIN_KEY) return res.status(401).json({ ok:false, error:'Não autorizado' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const raw = String(body.url || '').trim();
  let u: URL;
  try { u = new URL(raw); } catch { return res.status(400).json({ok:false,error:'URL inválida'}); }
  if (!['http:','https:'].includes(u.protocol) || privateHost(u.hostname)) return res.status(400).json({ok:false,error:'URL não permitida'});
  try {
    const r = await fetch(u.toString(), { headers: { 'User-Agent':'Leadcheck-PublicBusinessScanner/1.0' }, redirect:'follow' });
    if (!r.ok) return res.status(502).json({ok:false,error:`Fonte respondeu HTTP ${r.status}`});
    const type = r.headers.get('content-type') || '';
    if (!type.includes('text/html')) return res.status(415).json({ok:false,error:'A fonte não é HTML'});
    const html = (await r.text()).slice(0, 700_000);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
    const emails = [...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(x=>x.toLowerCase()).filter(x=>!x.includes('example.')))].slice(0,10);
    const phones = [...new Set((html.match(/(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g) || []).map(cleanPhone))].filter(x=>x.replace(/\D/g,'').length>=10).slice(0,10);
    const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({href:m[1],text:m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()})).filter(x=>/contato|contact|fale|sobre|email/i.test(x.text+' '+x.href)).slice(0,10);
    return res.status(200).json({ok:true,source:u.toString(),domain:domainOf(u.toString()),title,emails,phones,contactLinks:links});
  } catch (e) { return res.status(500).json({ok:false,error:e instanceof Error?e.message:'Falha ao consultar fonte'}); }
}
