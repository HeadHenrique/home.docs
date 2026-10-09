import {supabase} from './cloud';
import React,{useEffect,useRef,useState} from 'react';
import * as pdfjs from 'pdfjs-dist';
import{PDFDocument,StandardFonts,rgb}from'pdf-lib';
import{Plus,Type,Square,Pencil,Trash2,ChevronLeft,ChevronRight,Save,X}from'lucide-react';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
function hexToRgb(hex){const val=hex.replace('#','');return rgb(parseInt(val.slice(0,2),16)/255,parseInt(val.slice(2,4),16)/255,parseInt(val.slice(4,6),16)/255)}
export default function PdfEditor({file,onSave,onCancel}){
 const canvas=useRef(null),overlay=useRef(null),inlineInput=useRef(null),[inlineValue,setInlineValue]=useState(''),[textBlocks,setTextBlocks]=useState([]),[selectedText,setSelectedText]=useState(null),[doc,setDoc]=useState(null),[page,setPage]=useState(1),[count,setCount]=useState(1),[marks,setMarks]=useState([]),[tool,setTool]=useState('edit'),[text,setText]=useState('Novo texto'),[size,setSize]=useState(18),[color,setColor]=useState('#20242c'),[font,setFont]=useState('Helvetica'),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true,task;const load=async()=>{try{task=pdfjs.getDocument({data:new Uint8Array(await file.blob.arrayBuffer())});const pdf=await task.promise;if(active){setDoc(pdf);setCount(pdf.numPages)}}catch(e){if(active)setError('Não foi possível abrir este PDF para edição.')}};load();return()=>{active=false;if(task)task.destroy().catch(()=>{})}},[file.blob]);
 useEffect(()=>{if(!doc||!canvas.current)return;let cancelled=false;let renderTask;async function render(){try{const p=await doc.getPage(page),initial=p.getViewport({scale:1});const scale=Math.min(1.5,Math.max(.45,750/initial.width));const v=p.getViewport({scale});const c=canvas.current;if(!c||cancelled)return;c.width=Math.round(v.width);c.height=Math.round(v.height);renderTask=p.render({canvasContext:c.getContext('2d'),viewport:v});await renderTask.promise;const content=await p.getTextContent();const blocks=content.items.filter(i=>i.str?.trim()&&i.width>0).map((i,n)=>{const t=pdfjs.Util.transform(v.transform,i.transform);const fontSize=Math.hypot(t[2],t[3]);return {id:page+'-'+n,text:i.str,x:t[4]/v.width,y:(t[5]-fontSize)/v.height,width:Math.min(i.width*scale/v.width,1-t[4]/v.width),height:Math.max(fontSize/v.height,.007),size:fontSize/scale,fontFamily:content.styles[i.fontName]?.fontFamily||'sans-serif'}});if(!cancelled)setTextBlocks(blocks)}catch(e){if(!cancelled&&e?.name!=='RenderingCancelledException')setError('Falha ao exibir a página.')}}render();return()=>{cancelled=true;renderTask?.cancel()}},[doc,page]);

 useEffect(()=>{
  const base=canvas.current,layer=overlay.current;
  if(!base||!layer)return;
  layer.width=base.width;layer.height=base.height;
  const ctx=layer.getContext('2d'),background=base.getContext('2d',{willReadFrequently:true});
  if(!ctx||!background)return;
  for(const mark of marks.filter(m=>m.page===page)){
   const x=mark.x*layer.width,y=mark.y*layer.height;
   const height=mark.type==='cover'?52:Math.max((mark.height||.025)*layer.height+8,mark.size*2);
   const width=mark.type==='cover'?340:Math.max((mark.width||.05)*layer.width+8,mark.text.length*mark.size*1.2);
   const top=mark.type==='cover'?y-height:y-3;
   if(mark.type==='replace'||mark.type==='cover'){
    const sx=Math.min(base.width-1,Math.max(0,Math.floor(x+2))),sy=Math.min(base.height-1,Math.max(0,Math.floor(top-9)));
    const px=background.getImageData(sx,sy,1,1).data;
    ctx.fillStyle='rgb('+px[0]+','+px[1]+','+px[2]+')';
    ctx.fillRect(x-2,Math.max(0,top),Math.min(layer.width-x+2,width),height+6);
   }
   if(mark.type!=='cover'&&mark.text){
    ctx.fillStyle=mark.color;ctx.textBaseline='top';
    ctx.font=(mark.size*2)+'px '+(mark.font==='TimesRoman'?'Georgia':mark.font==='Courier'?'monospace':'Arial');
    ctx.fillText(mark.text,x,mark.type==='replace'?y:y-mark.size*2,layer.width-x-6);
   }
  }
  if(selectedText){
   const b=selectedText,x=b.x*layer.width,y=b.y*layer.height-3;
   const sx=Math.min(base.width-1,Math.max(0,Math.round(x+2))),sy=Math.min(base.height-1,Math.max(0,Math.round(y-9)));
   const px=background.getImageData(sx,sy,1,1).data;
   ctx.fillStyle='rgb('+px[0]+','+px[1]+','+px[2]+')';
   ctx.fillRect(x-2,Math.max(0,y),Math.min(layer.width-x+2,b.width*layer.width+8),Math.max(b.height*layer.height+10,10));
  }
 },[marks,page,textBlocks,selectedText]);
 const current=marks.filter(m=>m.page===page);const replacements=new Map(current.filter(m=>m.type==='replace').map(m=>[m.sourceId,m]));
 function chooseBlock(block){
  const previous=replacements.get(block.id);
  setSelectedText(block);setInlineValue(previous?.text??block.text);
  const family=block.fontFamily?.toLowerCase().includes('serif')&&!block.fontFamily?.toLowerCase().includes('sans')?'TimesRoman':block.fontFamily?.toLowerCase().includes('mono')?'Courier':'Helvetica';
  setFont(previous?.font||family);setSize(previous?.size||Math.max(8,Math.round(block.size)));
  const base=canvas.current;let detected='#20242c';
  if(base){const ctx=base.getContext('2d',{willReadFrequently:true});const xx=Math.min(base.width-1,Math.max(0,Math.round(block.x*base.width+block.width*base.width*.3))),yy=Math.min(base.height-1,Math.max(0,Math.round((block.y+block.height*.55)*base.height)));const data=ctx.getImageData(xx,yy,1,1).data;detected='#'+[...data].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')}
  setColor(previous?.color||detected);setTool('edit');requestAnimationFrame(()=>inlineInput.current?.focus());
 }
 function commitInline(value=inlineValue){
  if(!selectedText)return;
  const block=selectedText;
  setMarks(old=>[...old.filter(m=>m.sourceId!==block.id),{id:crypto.randomUUID(),sourceId:block.id,oldText:block.text,type:'replace',page,x:block.x,y:block.y,width:block.width,height:block.height,text:value,size:Number(size),color,font}]);
  setSelectedText(null);
 }
 function applyReplacement(){commitInline()}
 function place(e){if(!doc||tool==='edit')return;const rect=e.currentTarget.getBoundingClientRect();const x=Math.min(.97,Math.max(0,(e.clientX-rect.left)/rect.width)),y=Math.min(.97,Math.max(0,(e.clientY-rect.top)/rect.height));if(tool==='text'&&!text.trim()){setError('Digite o texto antes de inseri-lo.');return}setMarks(v=>[...v,{id:crypto.randomUUID(),page,x,y,type:tool,text,size:Number(size),color,font}]);setError('')}
 async function save(){
 if(!marks.length){setError('Faça uma alteração antes de salvar.');return}
 setSaving(true);setError('');
 try{
  if(marks.every(m=>m.type==='replace')){
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error('Sua sessão expirou. Entre novamente.');
   const bytes=new Uint8Array(await file.blob.arrayBuffer());
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   const edits=marks.map(m=>({page:m.page,oldText:m.oldText,newText:m.text,x:m.x,y:m.y}));
   const response=await fetch('/api/edit-pdf',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({pdf:btoa(binary),edits})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'A edição direta falhou.');
   const raw=atob(result.pdf);const output=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)output[i]=raw.charCodeAt(i);
   await onSave(new Blob([output],{type:'application/pdf'}));return;
  }
  const source=await PDFDocument.load(await file.blob.arrayBuffer());
  const result=await PDFDocument.create();
  for(let index=0;index<source.getPageCount();index++){
   const edits=marks.filter(m=>m.page===index+1);
   if(!edits.length){const [copy]=await result.copyPages(source,[index]);result.addPage(copy);continue}
   // Flatten only edited pages: the previous text is no longer embedded beneath a new overlay.
   const pdfPage=await doc.getPage(index+1);
   const dimensions=source.getPage(index).getSize();
   const factor=2;
   const viewport=pdfPage.getViewport({scale:factor});
   const raster=document.createElement('canvas');
   raster.width=Math.ceil(viewport.width);raster.height=Math.ceil(viewport.height);
   const context=raster.getContext('2d',{willReadFrequently:true});
   await pdfPage.render({canvasContext:context,viewport,background:'rgb(255,255,255)'}).promise;
   for(const mark of edits.filter(m=>m.type==='replace'||m.type==='cover')){
    let x=Math.floor(mark.x*raster.width),y=Math.floor(mark.y*raster.height);
    const width=mark.type==='cover'?Math.min(raster.width-x,170*factor):Math.min(raster.width-x,Math.max(mark.width*raster.width+8,mark.size*factor*mark.text.length*.65));
    const height=mark.type==='cover'?26*factor:Math.max(mark.height*raster.height+8,mark.size*factor*1.25);
    const top=mark.type==='cover'?y-height:y-4;
    // Sample nearby background to match solid-colored layouts instead of always painting white.
    const sampleX=Math.max(0,Math.min(raster.width-1,x+2)),sampleY=Math.max(0,Math.min(raster.height-1,top-8));
    const pixel=context.getImageData(sampleX,sampleY,1,1).data;
    context.fillStyle='rgb('+pixel[0]+','+pixel[1]+','+pixel[2]+')';
    context.fillRect(x-2,Math.max(0,top),width+4,height+8);
   }
   for(const mark of edits.filter(m=>m.type!=='cover'&&m.text)){
    const x=mark.x*raster.width,y=mark.y*raster.height;
    const fontFamily=mark.font==='TimesRoman'?'Georgia':mark.font==='Courier'?'monospace':'Arial';
    context.font=(mark.size*factor)+'px '+fontFamily;
    context.textBaseline='top';context.fillStyle=mark.color;
    context.fillText(mark.text,x,mark.type==='replace'?y:y-mark.size*factor,Math.max(10,raster.width-x-8));
   }
   const imageBytes=await new Promise((resolve,reject)=>raster.toBlob(async b=>b?resolve(await b.arrayBuffer()):reject(Error('Falha ao gerar página')),'image/png'));
   const image=await result.embedPng(imageBytes);
   const out=result.addPage([dimensions.width,dimensions.height]);
   out.drawImage(image,{x:0,y:0,width:dimensions.width,height:dimensions.height});
  }
  const bytes=await result.save();
  await onSave(new Blob([bytes],{type:'application/pdf'}));
 }catch(e){setError('Não foi possível salvar a edição: '+e.message)}
 finally{setSaving(false)}
}
 return <div className="pdf-editor"><div className="pdf-editor-tools"><div className="pdf-editor-group"><button className={tool==='edit'?'active':''} onClick={()=>{setTool('edit');setSelectedText(null)}}><Pencil size={16}/> Editar texto</button><button className={tool==='text'?'active':''} onClick={()=>setTool('text')}><Type size={16}/> Texto</button><button className={tool==='cover'?'active':''} onClick={()=>setTool('cover')}><Square size={16}/> Cobrir</button></div>{tool!=='edit'&&<input aria-label="Texto a adicionar" value={text} onChange={e=>setText(e.target.value)} disabled={tool==='cover'} placeholder="Texto para inserir"/>}<select value={font} onChange={e=>setFont(e.target.value)} aria-label="Fonte"><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option></select><input type="number" min="8" max="72" value={size} onChange={e=>setSize(Math.max(8,Math.min(72,Number(e.target.value)||12)))} title="Tamanho da fonte" aria-label="Tamanho da fonte"/><input type="color" value={color} onChange={e=>setColor(e.target.value)} title="Cor do texto" aria-label="Cor do texto"/><button onClick={()=>setMarks(m=>m.slice(0,-1))} disabled={!marks.length}><Trash2 size={15}/> Desfazer</button><button className="primary-btn" onClick={save} disabled={saving||!marks.length}><Save size={16}/>{saving?'Salvando...':'Salvar'}</button><button onClick={onCancel} aria-label="Cancelar edição"><X size={18}/></button></div><div className="pdf-editor-hint">{tool==='edit'?'Clique em um trecho identificado para alterar seu texto, fonte, tamanho e cor.':tool==='text'?'Clique na página para adicionar texto.':'Clique na página para cobrir visualmente um trecho.'} Substituições de texto são aplicadas no conteúdo interno do PDF ao salvar, quando a fonte permite. PDFs incompatíveis mostram um erro; nenhuma sobreposição será usada como alternativa.</div>{error&&<div className="pdf-editor-error" role="alert">{error}</div>}<div className="pdf-editor-workspace"><div className="pdf-editor-sheet" onClick={place}><canvas ref={canvas}/><canvas ref={overlay} className="pdf-editor-overlay"/>{selectedText&&<input ref={inlineInput} className="pdf-inline-input" aria-label="Editar texto selecionado" value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={()=>commitInline()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commitInline()}if(e.key==='Escape'){setSelectedText(null)}}} onClick={e=>e.stopPropagation()} style={{left:selectedText.x*100+'%',top:selectedText.y*100+'%',width:Math.max(selectedText.width*100,12)+'%',minHeight:Math.max(selectedText.height*100,2)+'%',color,fontSize:Math.max(9,size*(canvas.current?.clientWidth||700)/(canvas.current?.width||700)*2)+'px',fontFamily:font==='TimesRoman'?'Georgia':font==='Courier'?'monospace':'Arial'}}/>}{tool==='edit'&&textBlocks.map(b=><button type="button" key={b.id} className="pdf-text-target" title={'Editar: '+b.text} style={{left:b.x*100+'%',top:b.y*100+'%',width:b.width*100+'%',height:Math.max(b.height*100,1)+'%'}} onClick={e=>{e.stopPropagation();chooseBlock(b)}}/>)}</div></div><div className="pdf-editor-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/></button>Página {page} de {count}<button disabled={page>=count} onClick={()=>setPage(p=>p+1)}><ChevronRight size={18}/></button><span>{marks.length} alteração(ões)</span></div></div>;
}
