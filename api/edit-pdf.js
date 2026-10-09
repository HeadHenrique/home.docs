import {createClient} from '@supabase/supabase-js';
import {PdfDocument} from 'ts-pdf-edit';

export const config={api:{bodyParser:{sizeLimit:'12mb'}}};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
 const authorization=req.headers.authorization||'';
 const token=authorization.replace(/^Bearer\s+/i,'');
 if(!token)return res.status(401).json({error:'Faça login para editar PDFs.'});
 try{
  const supabase=createClient(process.env.VITE_SUPABASE_URL||'https://penyfgluluxlhsghntdj.supabase.co',process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_GtEyhgXLc3x6KQeBkAEZCg_v_GLrp4b',{auth:{persistSession:false}});
  const {data:{user},error:authError}=await supabase.auth.getUser(token);
  if(authError||!user)return res.status(401).json({error:'Sessão expirada.'});
  const {pdf,edits}=req.body||{};
  if(typeof pdf!=='string'||!Array.isArray(edits)||edits.length===0||edits.length>40)return res.status(400).json({error:'PDF ou alterações inválidas.'});
  if(pdf.length>10000000)return res.status(413).json({error:'Arquivo grande demais para edição neste modo.'});
  const bytes=Uint8Array.from(Buffer.from(pdf,'base64'));
  const document=await PdfDocument.open(bytes);
  try{
   const reports=[];
   for(const edit of edits){
    if(!Number.isInteger(edit.page)||edit.page<1||edit.page>document.pageCount||typeof edit.oldText!=='string'||!edit.oldText||typeof edit.newText!=='string'||edit.newText.length>3000)throw new Error('Alteração inválida.');
    const matches=await document.searchText(edit.oldText,{pages:[edit.page-1]});
    const hit=matches.filter(m=>m.pageIndex===edit.page-1).sort((a,b)=>{
      function distance(match){const r=match.rects?.[0];if(!r)return 1e10;return Math.abs(r.x-(edit.x||0))+Math.abs(r.y-(edit.y||0))}
      return distance(a)-distance(b)
    })[0];
    if(!hit)throw new Error('Não encontrei o texto original: '+edit.oldText.slice(0,55));
    const editor=document.getPage(hit.pageIndex).editor();
    const located=await editor.locate(hit);
    if(!located.editable)throw new Error('O texto não é editável diretamente neste PDF: '+(located.reason||'fonte protegida ou formato não suportado'));
    const report=await editor.rewriteText(located.located,edit.newText);
    reports.push({oldText:edit.oldText,newText:edit.newText,strategy:report.fontStrategy});
   }
   const saved=await document.save();
   return res.status(200).json({pdf:Buffer.from(saved.bytes).toString('base64'),reports});
  }finally{await document.close()}
 }catch(error){console.error('PDF edit rejected:',error);return res.status(422).json({error:error.message||'Não foi possível editar diretamente este PDF.'})}
}
