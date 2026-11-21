/* Utilitários compartilhados pelos editores locais. Sem backend e sem bibliotecas extras. */
window.FlashAdmin = (() => {
  const $ = id => document.getElementById(id);
  const trim = value => String(value ?? '').trim();
  const unique = arr => [...new Set(arr.map(trim).filter(Boolean))];
  const splitLines = value => unique(String(value || '').split(/\r?\n/));
  const asObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const msg = (message, level='info') => {
    const alert = $('message');
    alert.className = `alert alert-${level} mb-3`;
    alert.textContent = message;
    alert.hidden = false;
  };
  function addText(parent,tag,text,classes='') {
    const node = document.createElement(tag);
    if (classes) node.className=classes;
    node.textContent=text;
    parent.append(node);
    return node;
  }
  function btn(text, classes, onClick) {
    const el = document.createElement('button');
    el.type='button'; el.className=classes; el.textContent=text;
    el.addEventListener('click',onClick); return el;
  }
  function validation(data,enums) {
    const errors=[];
    if (!Array.isArray(data)) errors.push('data.json precisa ser um array de ervas.');
    if (!asObject(enums)) errors.push('enum.json precisa ser um objeto de categorias.');
    if (errors.length) return errors;
    const names=new Set();
    for (const [key,item] of Object.entries(enums)) {
      if (!key.trim()) errors.push('Uma categoria possui chave vazia.');
      if (!asObject(item)||!trim(item.enunciado)||!Array.isArray(item.alternativas)||!item.alternativas.length) {
        errors.push(`Categoria "${key}" deve ter enunciado e alternativas.`);continue;
      }
      if (unique(item.alternativas).length!==item.alternativas.length) errors.push(`Categoria "${key}": alternativas vazias ou repetidas.`);
    }
    data.forEach((herb,index)=>{
      const path=`Erva ${index+1}`;
      if (!asObject(herb)||!trim(herb.erva)) {errors.push(`${path}: nome inválido.`);return;}
      const name=trim(herb.erva).toLocaleLowerCase('pt-BR');
      if (names.has(name)) errors.push(`${path}: nome "${herb.erva}" duplicado.`);
      names.add(name);
      if (!Array.isArray(herb.hrefImages)||herb.hrefImages.some(url=>typeof url!=='string')) errors.push(`${path}: hrefImages deve ser array de strings.`);
      if (typeof herb.descricao!=='string') errors.push(`${path}: descricao deve ser texto.`);
      if (!Array.isArray(herb.perguntas)) {errors.push(`${path}: perguntas precisa ser um array.`);return;}
      const seen=new Set();
      herb.perguntas.forEach((q,j)=>{
        const key=q?.enum, category=enums[key];
        if (seen.has(key)) errors.push(`${path}: categoria "${key}" repetida.`);
        seen.add(key);
        if (!category) {errors.push(`${path}: pergunta ${j+1} referencia categoria inexistente "${key}".`);return;}
        if (!Array.isArray(q.resposta)||!q.resposta.length) {errors.push(`${path}: "${key}" precisa ter pelo menos uma resposta.`);return;}
        if (unique(q.resposta).length!==q.resposta.length) errors.push(`${path}: "${key}" tem resposta repetida ou vazia.`);
        for(const answer of q.resposta) if(!category.alternativas.includes(answer)) errors.push(`${path}: "${answer}" não consta nas alternativas de "${key}".`);
      });
    });
    return errors;
  }
  const store={ directory:null, data:null, enums:null };
  async function readJson(name) {
    if(store.directory) {
      const handle=await store.directory.getFileHandle(name);
      return JSON.parse(await (await handle.getFile()).text());
    }
    const response=await fetch(name,{cache:'no-store'});
    if(!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  }
  async function load() {
    store.data=await readJson('data.json');
    store.enums=await readJson('enum.json');
    return store;
  }
  async function chooseFolder() {
    if(!window.showDirectoryPicker) throw new Error('Seu navegador não suporta acesso de gravação em pastas. Use Chrome ou Edge atualizados em localhost.');
    const handle=await window.showDirectoryPicker({id:'flashcards-local',mode:'readwrite'});
    const old=store.directory;
    store.directory=handle;
    try { await load(); }
    catch(err) {store.directory=old; throw new Error('A pasta precisa conter data.json e enum.json válidos. '+err.message);}
    $('folderStatus').textContent=`Pasta conectada: ${handle.name} — salvamento direto habilitado`;
    return store;
  }
  async function save(name,value) {
    if(!store.directory) throw new Error('Conecte a pasta do projeto para sobrescrever o JSON original.');
    // Só grava arquivo já existente, não cria outro no lugar errado.
    const handle=await store.directory.getFileHandle(name);
    const writer=await handle.createWritable();
    try { await writer.write(JSON.stringify(value,null,2)+'\n'); await writer.close(); }
    catch(err) {try{await writer.abort();}catch(_){} throw err;}
    store[name==='data.json'?'data':'enums']=copy(value);
  }
  function download(name,value) {
    const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function setup(loaded) {
    $('connectFolder').addEventListener('click',async()=>{
      try{await chooseFolder();msg('Arquivos carregados da pasta selecionada. As alterações poderão sobrescrever os arquivos originais.','success');loaded();}
      catch(err){msg(err.message,'danger');}
    });
    $('folderStatus').textContent='Modo leitura: conecte a pasta local antes de salvar diretamente.';
  }
  return {$,trim,unique,splitLines,asObject,copy,msg,addText,btn,validation,store,load,chooseFolder,save,download,setup};
})();
