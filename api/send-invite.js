import {createClient} from '@supabase/supabase-js';
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'})}
 const {RESEND_API_KEY,RESEND_FROM_EMAIL,SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY}=process.env;
 if(!RESEND_API_KEY||!RESEND_FROM_EMAIL)return res.status(503).json({error:'Integração de e-mail não configurada no servidor.'});
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return res.status(401).json({error:'Sessão não encontrada.'});
 try{
  const supabase=createClient(SUPABASE_URL||'https://penyfgluluxlhsghntdj.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_GtEyhgXLc3x6KQeBkAEZCg_v_GLrp4b',{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data:{user},error:authError}=await supabase.auth.getUser(token);
  if(authError||!user)return res.status(401).json({error:'Sessão inválida.'});
  const email=String(req.body?.email||'').trim().toLowerCase();
  const role=req.body?.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['viewer','editor'].includes(role))return res.status(400).json({error:'Dados de convite inválidos.'});
  const {data:share,error:shareError}=await supabase.from('hd_shares').select('id,role').eq('owner_id',user.id).eq('invitee_email',email).maybeSingle();
  if(shareError||!share||share.role!==role)return res.status(403).json({error:'Convite não autorizado.'});
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const permission=role==='editor'?'Editor':'Visualizador';
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({
   from:RESEND_FROM_EMAIL,to:[email],subject:'Convite para acessar um espaço na home.docs',
   html:'<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:30px;color:#20242c"><h1 style="font-size:26px">home.docs</h1><h2>Você recebeu um convite</h2><p>'+safe(user.email||'Um usuário')+' compartilhou um espaço de documentos com você.</p><p>Permissão: <b>'+permission+'</b></p><p>Entre ou crie sua conta usando este endereço de e-mail.</p><a href="https://homedocs.vercel.app/" style="display:inline-block;background:#20242c;color:white;padding:13px 20px;border-radius:9px;text-decoration:none">Acessar home.docs</a></div>'
  })});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return res.status(502).json({error:'Não foi possível enviar o convite pela Resend.'});
  return res.status(200).json({success:true,id:result.id});
 }catch(e){console.error('Invitation email failure',e);return res.status(500).json({error:'Erro ao enviar o convite.'})}
}
