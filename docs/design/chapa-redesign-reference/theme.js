(() => {
  'use strict';
  const storageKey = 'chapa-concept-theme';
  const valid = ['light','dark','system'];
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const stored=localStorage.getItem(storageKey); if(valid.includes(stored)) preference=stored; } catch {}
  function render() {
    const effective=preference==='system'?(systemTheme.matches?'dark':'light'):preference;
    document.documentElement.dataset.theme=effective;
    document.documentElement.style.colorScheme=effective;
    const select=document.getElementById('theme-select');
    if(select) { select.value=preference; select.title=preference==='system'?'Following system: '+effective:'Theme: '+effective; }
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content=effective==='dark'?'#141719':'#f4f0e7';
  }
  window.chapaTheme=Object.freeze({
    set(mode) {
      if(!valid.includes(mode)) return false;
      preference=mode;
      try {localStorage.setItem(storageKey,preference);} catch {}
      render();
      return true;
    },
    getPreference:()=>preference,
    getEffective:()=>document.documentElement.dataset.theme,
  });
  render();
  systemTheme.addEventListener('change',()=>{if(preference==='system')render();});
  document.addEventListener('DOMContentLoaded',()=>{
    render();
    document.getElementById('theme-select').addEventListener('change',event=>window.chapaTheme.set(event.target.value));
  });
})();
