import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||'https://penyfgluluxlhsghntdj.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_GtEyhgXLc3x6KQeBkAEZCg_v_GLrp4b';
export const supabase=createClient(url,key);
const bucket='home-docs';
const getUser=async()=>{const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw Error('Faça login para acessar seus documentos.');return user};
const decode=x=>({id:x.id,kind:x.kind,name:x.name,parent:x.parent,folder:x.folder,category:x.category,color:x.color,size:Number(x.size)||0,mime:x.mime,created:new Date(x.created_at).getTime(),deleted:x.deleted,storage_path:x.storage_path});
export async function transaction(method,item){
 const user=await getUser();
 if(method==='all'){const {data,error}=await supabase.from('hd_items').select('*').order('created_at',{ascending:false});if(error)throw error;const entries=await Promise.all((data||[]).map(async x=>{const it=decode(x);if(it.kind==='file'&&it.storage_path&&!it.deleted){const {data:blob,error:downloadError}=await supabase.storage.from(bucket).download(it.storage_path);if(downloadError)throw downloadError;it.blob=blob}return it}));return entries}
 if(method==='put'){
  const original=item.storage_path||null;
  let path=original;
  if(item.kind==='file'&&item.blob&&!path){path=user.id+'/'+item.id+'/'+encodeURIComponent(item.name);const {error}=await supabase.storage.from(bucket).upload(path,item.blob,{contentType:item.mime||item.blob.type||'application/octet-stream',upsert:false});if(error)throw error}
  const record={id:item.id,user_id:user.id,kind:item.kind,name:item.name,parent:item.parent||null,folder:item.folder||null,category:item.category||null,color:item.color||null,size:item.size||0,mime:item.mime||null,storage_path:path,created_at:new Date(item.created||Date.now()).toISOString(),deleted:!!item.deleted};
  const {error}=await supabase.from('hd_items').upsert(record,{onConflict:'id'});if(error)throw error;return item.id
 }
 if(method==='delete'){
  const {data:row,error:lookupError}=await supabase.from('hd_items').select('storage_path').eq('id',item).single();if(lookupError)throw lookupError;
  const {error}=await supabase.from('hd_items').delete().eq('id',item);if(error)throw error;
  if(row.storage_path){const {error:storageError}=await supabase.storage.from(bucket).remove([row.storage_path]);if(storageError)throw storageError}return
 }
 throw Error('Operação inválida');
}
