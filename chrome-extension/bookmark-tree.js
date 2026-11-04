(() => {
  'use strict';
  // Shared by the extension and homepage; render user-provided names as text only.
  function mount(container, entries, selected, onChange, max = Infinity, onLimit = () => {}) {
    const doc=container.ownerDocument,root={children:new Map(),leaves:[],indices:[]},checks=[];
    entries.forEach((entry,index)=>{
      let node=root;node.indices.push(index);
      for(const name of entry.path){if(!node.children.has(name))node.children.set(name,{name,children:new Map(),leaves:[],indices:[]});node=node.children.get(name);node.indices.push(index);}
      node.leaves.push(index);
    });
    function checkbox(indices,leaf){
      const input=doc.createElement('input');input.type='checkbox';
      if(leaf!==undefined){input.value=leaf;input.dataset.bookmarkIndex=leaf;}else input.dataset.folderSelection='true';
      checks.push({input,indices});
      input.addEventListener('click',event=>event.stopPropagation());
      input.addEventListener('change',event=>{
        event.stopPropagation();
        if(input.checked&&new Set([...selected,...indices]).size>max){sync();onLimit();return;}
        indices.forEach(index=>input.checked?selected.add(index):selected.delete(index));onChange();sync();
      });return input;
    }
    function render(node,target){
      for(const child of node.children.values()){
        const details=doc.createElement('details'),summary=doc.createElement('summary'),label=doc.createElement('label'),name=doc.createElement('span'),body=doc.createElement('div');
        details.className='bookmark-tree-folder';details.open=true;name.textContent=`${child.name} (${child.indices.length})`;
        label.append(checkbox(child.indices),name);summary.append(label);body.className='bookmark-tree-children';details.append(summary,body);render(child,body);target.append(details);
      }
      for(const index of node.leaves){
        const row=doc.createElement('label'),text=doc.createElement('span'),title=doc.createElement('b'),url=doc.createElement('small');
        row.className='bookmark-transfer-row browser-bookmark-row';title.textContent=entries[index].title;url.textContent=entries[index].url;
        text.append(title,url);row.append(checkbox([index],index),text);target.append(row);
      }
    }
    function sync(){checks.forEach(({input,indices})=>{const count=indices.filter(index=>selected.has(index)).length;input.checked=count===indices.length;input.indeterminate=count>0&&count<indices.length;});}
    container.replaceChildren();render(root,container);sync();return {sync};
  }
  globalThis.QiPageBookmarkTree=Object.freeze({mount});
})();
