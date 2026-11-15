/* Selectores compactos y buscables, sincronizados con <select> de la aplicación. */
(()=>{
'use strict';
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const pickers=[];
const closeAll=except=>pickers.forEach(p=>{if(p!==except)p.close()});
function makePicker(select){
 if(!select||select.dataset.pickerReady)return;
 select.dataset.pickerReady='1';select.classList.add('picker-native');
 const wrap=document.createElement('div');wrap.className='field-picker';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='picker-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',select.getAttribute('aria-label')||select.previousElementSibling?.textContent||'Seleccionar');
 const val=document.createElement('span');val.className='picker-value'; const chevron=document.createElement('span');chevron.className='picker-chevron';chevron.textContent='⌄';
 trigger.append(val,chevron);
 const pop=document.createElement('div');pop.className='picker-popover';
 const search=document.createElement('input');search.className='picker-search';search.type='search';search.placeholder='Buscar en la lista…';search.autocomplete='off';search.setAttribute('aria-label','Buscar opción');
 const list=document.createElement('div');list.className='picker-options';list.setAttribute('role','listbox');
 const tip=document.createElement('div');tip.className='picker-tip';tip.textContent='Escribe para encontrar tu opción';
 pop.append(search,list,tip);wrap.append(trigger,pop);select.after(wrap);
 function opts(){return [...select.options].filter(o=>!o.disabled)}
 function sync(){let active=select.selectedOptions[0];val.textContent=active?.textContent?.trim()||'Seleccionar';trigger.disabled=select.disabled;tip.hidden=opts().length<=8}
 function render(){const query=norm(search.value.trim());const matched=opts().filter(o=>norm(o.textContent).includes(query));
   const shown=matched.slice(0,50);list.replaceChildren();
   if(!shown.length){const d=document.createElement('div');d.className='picker-empty';d.textContent='No encontramos esa opción';list.append(d);return}
   for(const o of shown){const b=document.createElement('button');b.type='button';b.className='picker-option';b.textContent=o.textContent.trim();b.setAttribute('role','option');b.setAttribute('aria-selected',String(o.value===select.value));
     b.addEventListener('click',()=>{select.value=o.value;sync();close();select.dispatchEvent(new Event('change',{bubbles:true}))});list.append(b)}
   tip.textContent=matched.length>shown.length?`Mostrando ${shown.length} de ${matched.length}; escribe para filtrar`:'Escribe para buscar más rápido';
 }
 function close(){wrap.classList.remove('open');trigger.setAttribute('aria-expanded','false');search.value=''}
 function open(){closeAll(api);sync();wrap.classList.add('open');trigger.setAttribute('aria-expanded','true');search.value='';render();requestAnimationFrame(()=>search.focus())}
 const api={select,wrap,close,sync};pickers.push(api);
 trigger.addEventListener('click',()=>wrap.classList.contains('open')?close():open());
 search.addEventListener('input',render);
 search.addEventListener('keydown',e=>{if(e.key==='Escape'){close();trigger.focus()}else if(e.key==='Enter'){e.preventDefault();const first=list.querySelector('button');first?.click()}});
 pop.addEventListener('keydown',e=>{if(e.key==='Escape'){close();trigger.focus()}});
 select.addEventListener('change',sync);
 new MutationObserver(()=>{sync();if(wrap.classList.contains('open'))render()}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 sync();
}
window.AgroPlantPickers={init(){document.querySelectorAll('.setup select').forEach(makePicker)},sync(){pickers.forEach(p=>p.sync())},close(){closeAll(null)}};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.field-picker'))closeAll(null)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll(null)});
})();
