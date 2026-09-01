import type { VercelRequest, VercelResponse } from '@vercel/node';

function authorized(req: VercelRequest) { return !!process.env.OWNER_ADMIN_KEY && String(req.headers['x-owner-key']||'') === process.env.OWNER_ADMIN_KEY; }
function dedupeKey(body:any){ const e=String(body.email||'').trim().toLowerCase(); const p=String(body.phone||'').replace(/\D/g,''); const c=String(body.company||'').trim().toLowerCase().replace(/\s+/g,' '); return e ? `email:${e}` : p ? `phone:${p}` : `company:${c}|name:${String(body.name||'').trim().toLowerCase()}`; }
function supabase(path:string, init:RequestInit={}) {
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,''); const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
  return fetch(`${base}/rest/v1/${path}`, { ...init, headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...(init.headers||{}) } });
}
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!authorized(req)) return res.status(401).json({ok:false,error:'Não autorizado'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ok:false,error:'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'});
  try {
    if(req.method==='GET'){
      const q=String((req.query.q||'')).trim(); const status=String(req.query.status||'');
      const params=new URLSearchParams({select:'*',order:'created_at.desc',limit:'500'});
      if(status) params.set('status',`eq.${status}`); if(q) params.set('or',`name.ilike.*${q}*,email.ilike.*${q}*,phone.ilike.*${q}*,company.ilike.*${q}*`);
      const r=await supabase(`owner_leads?${params}`); const j=await r.json(); return res.status(r.status).json(j);
    }
    if(req.method==='POST'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{};
      const lead={name:String(body.name||'').trim(),company:String(body.company||'').trim(),email:String(body.email||'').trim().toLowerCase()||null,phone:String(body.phone||'').replace(/\D/g,'')||null,source:String(body.source||'manual'),source_url:body.source_url||null,source_note:body.source_note||null,consent_at:body.consent_at||null,status:body.status||'novo',score:Number(body.score||0),tags:Array.isArray(body.tags)?body.tags:[],notes:String(body.notes||''),dedupe_key:dedupeKey(body)};
      if(!lead.name && !lead.company && !lead.email && !lead.phone) return res.status(400).json({ok:false,error:'Informe ao menos nome, empresa, e-mail ou telefone'});
      const r=await supabase('owner_leads',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(lead)}); const j=await r.json(); return res.status(r.status).json(j);
    }
    if(req.method==='PATCH'){
      const id=String(req.query.id||''); if(!id) return res.status(400).json({ok:false,error:'id obrigatório'});
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}; const allowed=['name','company','email','phone','status','score','tags','notes','consent_at','source','source_url','source_note','owner']; const patch:any={updated_at:new Date().toISOString()}; for(const k of allowed) if(k in body) patch[k]=body[k];
      const r=await supabase(`owner_leads?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)}); const j=await r.json(); return res.status(r.status).json(j);
    }
    return res.status(405).json({ok:false,error:'Método não suportado'});
  } catch(e){ return res.status(500).json({ok:false,error:e instanceof Error?e.message:'Erro interno'}); }
}
