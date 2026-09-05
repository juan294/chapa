(() => {
  'use strict';
  const q = selector => document.querySelector(selector);
  const dock = q('.command-dock');
  const input = q('#shell-input');
  const panel = q('#shell-panel');
  const list = q('#shell-suggestions');
  const output = q('#shell-output');
  const heading = q('#shell-panel-title');
  const origin = 'https://chapa.thecreativetoken.com';
  const history = [];
  let historyIndex = 0;
  let historyDraft = '';
  let matches = [];
  let selected = 0;
  let returnFocus = null;

  const commands = [
    { name:'/help', description:'Show every available command', kind:'help' },
    { name:'/theme', usage:'/theme [light|dark|system]', description:'Inspect or change the color theme', kind:'theme' },
    { name:'/badge-lab', description:'Compare the actual SVG design proposal', localPath:'/badge-lab/' },
    { name:'/home', description:'Back to the opening screen', section:'main' },
    { name:'/whoami', description:'Inspect the illustrative sample profile', kind:'whoami' },
    { name:'/about', description:'The idea behind Chapa', section:'idea' },
    { name:'/archetypes', description:'Explore the seven developer identities', section:'identity' },
    { name:'/scoring', usage:'/scoring [dimension]', description:'Read or expand a scoring dimension', section:'anatomy' },
    { name:'/embed', description:'See Chapa in a README', section:'embed' },
    { name:'/copy', description:'Copy the example Markdown embed', kind:'copy' },
    { name:'/mcp', description:'Explore the agent workflow', section:'mcp' },
    { name:'/verify', description:'Understand the verification seal', section:'verify' },
    { name:'/studio', description:'Open the live Creator Studio ↗', path:'/studio?demo=1' },
    { name:'/login', description:'Sign in on the live Chapa site ↗', path:'/api/auth/login' },
    { name:'/badge', usage:'/badge <handle>', description:'Open a developer’s live profile ↗', kind:'badge' },
    ...Object.entries(profiles).map(([type, p]) => ({ name:'/'+type, description:'Explore the '+p.name+' sample', type })),
    { name:'/terms', description:'Read Chapa’s terms ↗', path:'/terms' },
    { name:'/privacy', description:'Read Chapa’s privacy policy ↗', path:'/privacy' },
    { name:'/clear', description:'Clear terminal output', kind:'clear' },
  ];

  function line(text, type='info') {
    const element = document.createElement('div');
    element.className = 'output-line '+type;
    element.textContent = text;
    output.append(element);
  }

  function closePanel() {
    panel.hidden = true;
    list.hidden = true;
    output.hidden = true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    matches = [];
  }

  function showOutput(title='session output') {
    panel.hidden = false;
    list.hidden = true;
    output.hidden = false;
    output.replaceChildren();
    heading.textContent = title;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    matches = [];
    panel.scrollTop = 0;
  }

  function focusShell(value='/') {
    if (!dock.contains(document.activeElement)) returnFocus = document.activeElement;
    input.focus({preventScroll:true});
    input.value = value;
    input.setSelectionRange(value.length,value.length);
    renderSuggestions();
  }

  function renderSuggestions() {
    const partial = input.value.trim().toLowerCase();
    matches = partial.startsWith('/') && !/\s/.test(partial)
      ? commands.filter(c => c.name.startsWith(partial)).slice(0,8) : [];
    selected = 0;
    list.replaceChildren();
    if (!matches.length) { closePanel(); return; }
    panel.hidden = false;
    list.hidden = false;
    output.hidden = true;
    heading.textContent = partial === '/' ? 'available commands · /help for the full list' : 'matching commands';
    input.setAttribute('aria-expanded','true');
    matches.forEach((command, index) => {
      const option = document.createElement('div');
      option.className = 'shell-option';
      option.id = 'shell-option-'+index;
      option.setAttribute('role','option');
      const name = document.createElement('span');
      name.className = 'shell-option-name';
      name.textContent = command.usage || command.name;
      const description = document.createElement('span');
      description.className = 'shell-option-desc';
      description.textContent = command.description;
      option.append(name,description);
      option.addEventListener('mousedown',e => e.preventDefault());
      option.addEventListener('click',() => choose(command));
      list.append(option);
    });
    updateSelection();
  }

  function updateSelection() {
    [...list.children].forEach((element,i) => element.setAttribute('aria-selected',String(i===selected)));
    const active = list.children[selected];
    if (active) {
      input.setAttribute('aria-activedescendant',active.id);
      active.scrollIntoView({block:'nearest'});
    }
  }

  function choose(command) {
    if (command.kind === 'badge') {
      input.value = '/badge ';
      closePanel();
      input.focus({preventScroll:true});
      showOutput('command usage');
      line('/badge <github-handle>','system');
      line('Example: /badge juan294','dim');
      line('Opens the profile on the live Chapa site.','dim');
    } else {
      run(command.name);
    }
  }

  function goTo(section) {
    const element = document.getElementById(section);
    if (section === 'main') window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    else element?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    q('#dock-path').textContent = '~/'+({main:'home',idea:'about',identity:'archetypes',anatomy:'scoring'}[section] || section);
  }

  function showHelp() {
    line('Navigate the page. Explore a profile. Make yourself at home.','system');
    line('↗ commands open the live Chapa website.','dim');
    commands.forEach(command => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'help-command';
      const name = document.createElement('code');
      name.textContent = command.usage || command.name;
      const description = document.createElement('span');
      description.textContent = command.description;
      button.append(name,description);
      button.addEventListener('click',() => choose(command));
      output.append(button);
    });
    line('↑↓ suggestions · tab complete · ↑ on empty input: history · esc dismiss','dim');
  }

  function run(raw) {
    const text = raw.trim();
    if (!text) return;
    history.push(text);
    if (history.length > 50) history.shift();
    historyIndex = history.length;
    historyDraft = '';
    input.value = '';
    const [name,...args] = text.split(/\s+/);
    const normalized = name.toLowerCase() === '/b' ? '/badge' : name.toLowerCase();
    const command = commands.find(c => c.name === normalized);
    showOutput();
    line('chapa > '+text,'input');
    if (!command) {
      line('command not found: '+name,'error');
      line('Try /help. Tab completes a command as you type.','dim');
      return;
    }
    if (args.length && command.kind !== 'badge' && command.name !== '/scoring' && command.kind !== 'theme') {
      line('Usage: '+(command.usage || command.name),'error');
      return;
    }
    if (command.kind === 'theme') {
      if (args.length > 1 || (args.length === 1 && !window.chapaTheme.set(args[0].toLowerCase()))) {
        line('Usage: /theme [light|dark|system]','error');
        return;
      }
      line('theme      '+window.chapaTheme.getPreference()+' · rendering '+window.chapaTheme.getEffective(),'success');
      line('Use /theme light, /theme dark, or /theme system.','dim');
      return;
    }
    if (command.name === '/scoring' && args.length) {
      const dimensionIndex = dimensions.findIndex(d => d.toLowerCase() === args[0].toLowerCase());
      if (args.length !== 1 || dimensionIndex < 0) {
        line('Usage: /scoring [delivery|quality|consistency|breadth|craft]','error');
        return;
      }
      document.querySelectorAll('.dimensions details').forEach((detail,i) => { detail.open=i===dimensionIndex; });
    }
    if (command.kind === 'copy') {
      goTo('embed');
      q('#copy-embed').click();
      closePanel();
      input.focus({preventScroll:true});
      return;
    }
    if (command.kind === 'clear') { closePanel(); return; }
    if (command.kind === 'help') { heading.textContent='chapa /help'; showHelp(); return; }
    if (command.kind === 'whoami') {
      line('session    guest · local design exploration','dim');
      line('sample     Bertram Gilfoyle / @developer','system');
      line('archetype  Builder');
      line('impact     82 / 100 · illustrative data');
      line('Try /builder to explore the sample, or /badge <handle> for a live profile.','dim');
      return;
    }
    if (command.kind === 'badge') {
      const handle = (args[0] || '').replace(/^@/,'');
      if (args.length !== 1 || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(handle)) {
        line('Usage: /badge <github-handle>','error');
        line('Example: /badge juan294','dim');
        return;
      }
      line('Opening the live profile for @'+handle+'…','system');
      window.location.assign(origin+'/u/'+encodeURIComponent(handle));
      return;
    }
    if (command.localPath) { window.location.assign(command.localPath); return; }
    if (command.path) {
      line('Opening '+origin+command.path+'…','system');
      window.location.assign(origin+command.path);
      return;
    }
    if (command.type) {
      selectType(command.type);
      goTo('identity');
      line('Selected '+profiles[command.type].name+' · illustrative sample.','success');
    } else {
      goTo(command.section);
      line('→ '+command.description,'success');
    }
    // Navigation leaves the document in view; focus stays in the shell for the next command.
    closePanel();
    input.focus({preventScroll:true});
  }

  q('#shell-form').addEventListener('submit',e => {
    e.preventDefault();
    const exact = commands.find(c => c.name === input.value.trim().toLowerCase());
    if (!list.hidden && matches.length && !exact && !/\s/.test(input.value.trim())) choose(matches[selected]);
    else if (exact?.kind === 'badge') choose(exact);
    else run(input.value);
  });
  input.addEventListener('input',() => { historyIndex=history.length; renderSuggestions(); });
  input.addEventListener('keydown',e => {
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault(); closePanel(); input.value=''; input.blur();
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !list.hidden && matches.length) {
      e.preventDefault(); input.value=matches[selected].name+(matches[selected].kind==='badge'?' ':''); closePanel(); return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta=e.key==='ArrowUp'?-1:1;
      if (!list.hidden && matches.length) {
        selected=(selected+delta+matches.length)%matches.length; updateSelection();
      } else if (history.length) {
        if (historyIndex===history.length) historyDraft=input.value;
        historyIndex=Math.max(0,Math.min(history.length,historyIndex+delta));
        input.value=historyIndex===history.length?historyDraft:history[historyIndex];
        closePanel();
        input.setSelectionRange(input.value.length,input.value.length);
      }
    }
  });
  q('#shell-close').addEventListener('click',() => { closePanel(); input.focus({preventScroll:true}); });
  document.querySelectorAll('[data-command-focus]').forEach(button => button.addEventListener('click',() => focusShell(button.dataset.commandFocus)));
  document.addEventListener('keydown',e => {
    if (e.isComposing || e.defaultPrevented) return;
    const target=e.target;
    const editing=target instanceof Element && (target.matches('input,textarea,select') || target.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') {
      e.preventDefault(); focusShell('/');
    } else if (e.key==='/' && !e.metaKey && !e.ctrlKey && !e.altKey && !editing) {
      e.preventDefault(); focusShell('/');
    } else if (e.key==='Escape' && !panel.hidden) {
      closePanel();
    }
  });
  document.addEventListener('pointerdown',e => {
    if (!dock.contains(e.target) && !list.hidden) closePanel();
  });
  const sections = [['main','home'],['idea','about'],['identity','archetypes'],['anatomy','scoring'],['embed','embed'],['mcp','mcp'],['verify','verify']];
  let scrollQueued = false;
  function updatePath() {
    let current = 'home';
    for (const [id,path] of sections) {
      if (document.getElementById(id).getBoundingClientRect().top <= window.innerHeight * .35) current=path;
    }
    const next = '~/'+current;
    if (q('#dock-path').textContent !== next) q('#dock-path').textContent=next;
    scrollQueued = false;
  }
  window.addEventListener('scroll',() => {
    if (!scrollQueued) { scrollQueued=true; requestAnimationFrame(updatePath); }
  },{passive:true});
  updatePath();
})();
