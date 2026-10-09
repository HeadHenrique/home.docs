// Reads the storage used by home.docs before cloud migration.
// Available only in the same browser profile and site origin where files were saved.
const DB='homedocs-v1',STORE='items';
export async function readLegacyItems(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB);
  req.onupgradeneeded=()=>{req.transaction.abort();reject(new Error('Nenhuma biblioteca local antiga encontrada.'))};
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(STORE)){db.close();resolve([]);return}
   const tx=db.transaction(STORE,'readonly'),get=tx.objectStore(STORE).getAll();
   get.onsuccess=()=>resolve(get.result||[]);
   get.onerror=()=>reject(get.error);
   tx.oncomplete=()=>db.close();
  };
 });
}
