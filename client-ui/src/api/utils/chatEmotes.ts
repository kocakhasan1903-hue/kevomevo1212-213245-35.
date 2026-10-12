export type ChatEmote = {keyword:string;url:string;category:'standard'|'custom'|'premium'};
let catalog:ChatEmote[]=[];
export const getChatEmotes=()=>catalog;
let definitions=new Map<string,string>();
let fetchedAt=0;
let pending:Promise<void>|null=null;
const entities:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escapeAttribute=(value:string)=>value.replace(/[&<>"']/g,c=>entities[c]||c);
export function setChatEmotes(items:unknown,origin=window.location.origin){const next=new Map<string,string>();const entries:ChatEmote[]=[];if(Array.isArray(items))for(const item of items.slice(0,1000)){if(!item||typeof item.keyword!=='string'||typeof item.image_url!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(item.keyword))continue;try{const source=item.image_url;const url=new URL(source,origin);if(url.protocol!=='https:'&&!(source.startsWith('/')&&!source.startsWith('//')&&url.origin===origin))continue;if(url.username||url.password)continue;next.set(item.keyword,url.href);entries.push({keyword:item.keyword,url:url.href,category:['standard','premium'].includes(item.category)?item.category:'custom'});}catch{continue;}}definitions=next;catalog=entries;}
export function refreshChatEmotes(){if(pending||Date.now()-fetchedAt<120000)return pending||Promise.resolve();fetchedAt=Date.now();pending=fetch('/assets/uploads/chat-emotes.json',{credentials:'omit',cache:'no-cache'}).then(async response=>{if(response.ok)setChatEmotes(await response.json());}).catch(()=>{}).finally(()=>{pending=null;});return pending;}
export function formatChatEmotes(text:string){return text.replace(/:([A-Za-z0-9_-]{1,40}):/g,(token,name)=>{const source=definitions.get(name);return source?`<img class="cms-chat-emote" src="${escapeAttribute(source)}" alt="${escapeAttribute(token)}" style="max-width:40px;max-height:40px;vertical-align:middle;image-rendering:pixelated" />`:token;});}

// Only replace text nodes: link attributes and generated media markup stay intact.
export function formatChatEmoteMarkup(markup:string){
 const template=document.createElement('template');template.innerHTML=markup;
 const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);
 const nodes:Text[]=[];let node:Node|null;while((node=walker.nextNode()))nodes.push(node as Text);
 for(const text of nodes){if(text.parentElement?.closest('a,script,style,audio'))continue;const escaped=escapeAttribute(text.data);const formatted=formatChatEmotes(escaped);if(formatted===escaped)continue;const replacement=document.createElement('template');replacement.innerHTML=formatted;text.replaceWith(replacement.content);}
 return template.innerHTML;
}

