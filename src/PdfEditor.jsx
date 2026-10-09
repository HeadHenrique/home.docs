import React,{useEffect,useRef,useState} from 'react';
import * as pdfjs from 'pdfjs-dist';
import{PDFDocument,StandardFonts,rgb}from'pdf-lib';
import{Plus,Type,Square,Pencil,Trash2,ChevronLeft,ChevronRight,Save,X}from'lucide-react';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
function hexToRgb(hex){const val=hex.replace('#','');return rgb(parseInt(val.slice(0,2),16)/255,parseInt(val.slice(2,4),16)/255,parseInt(val.slice(4,6),16)/255)}
export default function PdfEditor({file,onSave,onCancel}){
 const canvas=useRef(null),[textBlocks,setTextBlocks]=useState([]),[selectedText,setSelectedText]=useState(null),[doc,setDoc]=useState(null),[page,setPage]=useState(1),[count,setCount]=useState(1),[marks,setMarks]=useState([]),[tool,setTool]=useState('edit'),[text,setText]=useState('Novo texto'),[size,setSize]=useState(18),[color,setColor]=useState('#20242c'),[font,setFont]=useState('Helvetica'),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true,task;const load=async()=>{try{task=pdfjs.getDocument({data:new Uint8Array(await file.blob.arrayBuffer())});const pdf=await task.promise;if(active){setDoc(pdf);setCount(pdf.numPages)}}catch(e){if(active)setError('Não foi possível abrir este PDF para edição.')}};load();return()=>{active=false;if(task)task.destroy().catch(()=>{})}},[file.blob]);
 useEffect(()=>{if(!doc||!canvas.current)return;let cancelled=false;let renderTask;async function render(){try{const p=await doc.getPage(page),initial=p.getViewport({scale:1});const scale=Math.min(1.5,Math.max(.45,750/initial.width));const v=p.getViewport({scale});const c=canvas.current;if(!c||cancelled)return;c.width=Math.round(v.width);c.height=Math.round(v.height);renderTask=p.render({canvasContext:c.getContext('2d'),viewport:v});await renderTask.promise;const content=await p.getTextContent();const blocks=content.items.filter(i=>i.str?.trim()&&i.width>0).map((i,n)=>{const t=pdfjs.Util.transform(v.transform,i.transform);const fontSize=Math.hypot(t[2],t[3]);return {id:page+'-'+n,text:i.str,x:t[4]/v.width,y:(t[5]-fontSize)/v.height,width:Math.min(i.width*scale/v.width,1-t[4]/v.width),height:Math.max(fontSize/v.height,.007),size:fontSize/scale}});if(!cancelled)setTextBlocks(blocks)}catch(e){if(!cancelled&&e?.name!=='RenderingCancelledException')setError('Falha ao exibir a página.')}}render();return()=>{cancelled=true;renderTask?.cancel()}},[doc,page]);
 const current=marks.filter(m=>m.page===page);const replacements=new Map(current.filter(m=>m.type==='replace').map(m=>[m.sourceId,m]));
 function chooseBlock(block){setSelectedText(block);setText(replacements.get(block.id)?.text??block.text);setSize(Math.round(block.size)||18);setTool('edit')}
 function applyReplacement(){if(!selectedText)return;const rect=selectedText;const canvasEl=canvas.current;const ctx=canvasEl?.getContext('2d');let background='#ffffff';try{const x=Math.min(canvasEl.width-1,Math.max(0,Math.floor(rect.x*canvasEl.width+2))),y=Math.min(canvasEl.height-1,Math.max(0,Math.floor(rect.y*canvasEl.height-4)));const p=ctx.getImageData(x,y,1,1).data;background='#'+[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('')}catch{}setMarks(old=>[...old.filter(m=>m.sourceId!==rect.id),{id:crypto.randomUUID(),sourceId:rect.id,type:'replace',page,x:rect.x,y:rect.y,width:rect.width,height:rect.height,text,size:Number(size),color,font,background}]);setSelectedText(null)}
 function place(e){if(!doc||tool==='edit')return;const rect=e.currentTarget.getBoundingClientRect();const x=Math.min(.97,Math.max(0,(e.clientX-rect.left)/rect.width)),y=Math.min(.97,Math.max(0,(e.clientY-rect.top)/rect.height));if(tool==='text'&&!text.trim()){setError('Digite o texto antes de inseri-lo.');return}setMarks(v=>[...v,{id:crypto.randomUUID(),page,x,y,type:tool,text,size:Number(size),color,font}]);setError('')}
 async function save(){
 if(!marks.length){setError('Faça uma alteração antes de salvar.');return}
 setSaving(true);setError('');
 try{
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
 return <div className="pdf-editor"><div className="pdf-editor-tools"><div className="pdf-editor-group"><button className={tool==='edit'?'active':''} onClick={()=>{setTool('edit');setSelectedText(null)}}><Pencil size={16}/> Editar texto</button><button className={tool==='text'?'active':''} onClick={()=>setTool('text')}><Type size={16}/> Texto</button><button className={tool==='cover'?'active':''} onClick={()=>setTool('cover')}><Square size={16}/> Cobrir</button></div><input aria-label="Texto a adicionar" value={text} onChange={e=>setText(e.target.value)} disabled={tool==='cover'} placeholder="Texto para inserir"/><select value={font} onChange={e=>setFont(e.target.value)} aria-label="Fonte"><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option></select><input type="number" min="8" max="72" value={size} onChange={e=>setSize(Math.max(8,Math.min(72,Number(e.target.value)||12)))} title="Tamanho da fonte" aria-label="Tamanho da fonte"/><input type="color" value={color} onChange={e=>setColor(e.target.value)} title="Cor do texto" aria-label="Cor do texto"/><button onClick={()=>setMarks(m=>m.slice(0,-1))} disabled={!marks.length}><Trash2 size={15}/> Desfazer</button><button className="primary-btn" onClick={save} disabled={saving||!marks.length}><Save size={16}/>{saving?'Salvando...':'Salvar'}</button><button onClick={onCancel} aria-label="Cancelar edição"><X size={18}/></button></div><div className="pdf-editor-hint">{tool==='edit'?'Clique em um trecho identificado para alterar seu texto, fonte, tamanho e cor.':tool==='text'?'Clique na página para adicionar texto.':'Clique na página para cobrir visualmente um trecho.'} As páginas alteradas serão convertidas em imagem ao salvar, removendo seu texto selecionável. Guarde o original.</div>{error&&<div className="pdf-editor-error" role="alert">{error}</div>}{selectedText&&<div className="pdf-edit-selection"><span>Editando texto existente:</span><strong>{selectedText.text}</strong><button className="primary-btn" onClick={applyReplacement}>Substituir texto</button><button onClick={()=>{setText('');setMarks(old=>[...old.filter(m=>m.sourceId!==selectedText.id),{id:crypto.randomUUID(),sourceId:selectedText.id,type:'replace',page,x:selectedText.x,y:selectedText.y,width:selectedText.width,height:selectedText.height,text:'',size,color,font}]);setSelectedText(null)}}><Trash2 size={15}/> Apagar texto</button><button onClick={()=>setSelectedText(null)}>Cancelar</button></div>}<div className="pdf-editor-workspace"><div className="pdf-editor-sheet" onClick={place}><canvas ref={canvas}/>{tool==='edit'&&textBlocks.map(b=><button type="button" key={b.id} className="pdf-text-target" title={'Editar: '+b.text} style={{left:b.x*100+'%',top:b.y*100+'%',width:b.width*100+'%',height:Math.max(b.height*100,1)+'%'}} onClick={e=>{e.stopPropagation();chooseBlock(b)}}/>)}{current.map(m=><div key={m.id} className={'pdf-editor-mark '+(m.type==='cover'?'cover':m.type==='replace'?'replacement':'')} style={{left:(m.x*100)+'%',top:(m.y*100)+'%',fontSize:Math.max(10,m.size*(canvas.current?.clientWidth||700)/(canvas.current?.width||700))+'px',color:m.color,fontFamily:m.font==='TimesRoman'?'Georgia':m.font==='Courier'?'monospace':'Arial',background:m.type==='replace'?m.background:undefined}}>{m.type==='cover'?'':m.text}</div>)}</div></div><div className="pdf-editor-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/></button>Página {page} de {count}<button disabled={page>=count} onClick={()=>setPage(p=>p+1)}><ChevronRight size={18}/></button><span>{marks.length} alteração(ões)</span></div></div>;
}
