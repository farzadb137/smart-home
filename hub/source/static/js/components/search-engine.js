// Shared search/filter engine. Pages provide the collection and fields.
export function createSearchEngine({getItems=()=>[], fields=()=>[] }={}){
 let query='';
 return {
   setQuery(value){query=String(value||'').trim().toLowerCase();},
   getQuery(){return query;},
   filter(items=getItems()){return items.filter(item=>!query || fields(item).join(' ').toLowerCase().includes(query));},
   search(){return this.filter(getItems());}
 };
}

export function matchesQuery(item, query, fields=()=>[]){const q=String(query||'').trim().toLowerCase();return !q||fields(item).join(' ').toLowerCase().includes(q);}
