import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||'https://penyfgluluxlhsghntdj.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_GtEyhgXLc3x6KQeBkAEZCg_v_GLrp4b';
export const supabase=createClient(url,key);
const bucket='home-docs';
const getUser=async()=>{const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw Error('Faça login para acessar seus documentos.');return user};
const decode=x=>({id:x.id,user_id:x.user_id,kind:x.kind,name:x.name,parent:x.parent,folder:x.folder,category:x.category,color:x.color,size:Number(x.size)||0,mime:x.mime,created:new Date(x.created_at).getTime(),deleted:x.deleted,storage_path:x.storage_path});
export async function transaction(method,item,workspaceId){
 const user=await getUser();
 const ownerId=workspaceId||user.id;
 if(method==='all'){const {data,error}=await supabase.from('hd_items').select('id,user_id,kind,name,parent,folder,category,color,size,mime,created_at,deleted,storage_path').eq('user_id',ownerId).order('created_at',{ascending:false});if(error)throw error;return (data||[]).map(decode)}
 if(method==='put'){
  const original=item.storage_path||null;
  let path=original;
  if(item.kind==='file'&&item.blob&&!path){const ext=(item.name?.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';path=ownerId+'/'+item.id+'/document.'+ext;const mime=ext==='pdf'?'application/pdf':ext==='txt'?'text/plain':ext==='png'?'image/png':['jpg','jpeg'].includes(ext)?'image/jpeg':'application/octet-stream';const {error}=await supabase.storage.from(bucket).upload(path,item.blob,{contentType:mime,upsert:false});if(error)throw new Error('Storage: '+error.message)}
  const record={id:item.id,user_id:ownerId,kind:item.kind,name:item.name,parent:item.parent||null,folder:item.folder||null,category:item.category||null,color:item.color||null,size:item.size||0,mime:item.mime||null,storage_path:path,created_at:new Date(item.created||Date.now()).toISOString(),deleted:!!item.deleted};
  const {error}=await supabase.from('hd_items').upsert(record,{onConflict:'id'});if(error)throw error;return item.id
 }
 if(method==='delete'){
  const {data:row,error:lookupError}=await supabase.from('hd_items').select('storage_path').eq('id',item).single();if(lookupError)throw lookupError;
  const {error}=await supabase.from('hd_items').delete().eq('id',item);if(error)throw error;
  if(row.storage_path){const {error:storageError}=await supabase.storage.from(bucket).remove([row.storage_path]);if(storageError)throw storageError}return
 }
 throw Error('Operação inválida');
}

export async function getFileBlob(file){if(file.blob)return file.blob;if(!file.storage_path)throw Error('Arquivo sem caminho de armazenamento.');const {data,error}=await supabase.storage.from(bucket).download(file.storage_path);if(error)throw error;return data}
