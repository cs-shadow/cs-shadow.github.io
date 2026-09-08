"use strict";
// A minimal event/DOM fixture for controller integration tests. It does not
// perform browser layout, paint, accessibility-tree or visual verification.
class Element {
  constructor(tag,document){this.tagName=tag.toUpperCase();this.localName=tag.toLowerCase();this.nodeType=tag==="#text"?3:1;this.ownerDocument=document;this.children=[];this.parentNode=null;this.attributes={};this.listeners={};this.value="";this.hidden=false;this.disabled=false;this.style={};this.dataset={};this._text="";this.className="";this.classList={add:(...names)=>{this.className=[...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(" ");},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(" ");},contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,force)=>{const enabled=force===undefined?!this.classList.contains(name):force;enabled?this.classList.add(name):this.classList.remove(name);return enabled;}};}
  get childNodes(){return this.children;}
  get lastChild(){return this.children.at(-1)||null;}
  get nodeValue(){return this._text;}
  set nodeValue(value){this._text=String(value);}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join("");}
  set textContent(text){this._text=String(text);for(const child of this.children)child.parentNode=null;this.children=[];}
  setAttribute(name,value){this.attributes[name]=String(value);if(name==="disabled")this.disabled=true;if(name==="id")this.id=String(value);if(name==="class")this.className=String(value);if(name==="value")this.value=String(value);if(name.startsWith("data-"))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,char)=>char.toUpperCase())]=String(value);}
  getAttribute(name){if(name.startsWith("data-")){const key=name.slice(5).replace(/-([a-z])/g,(_,char)=>char.toUpperCase());if(this.dataset[key]!==undefined)return String(this.dataset[key]);}return Object.hasOwn(this.attributes,name)?this.attributes[name]:null;}
  removeAttribute(name){delete this.attributes[name];if(name==="disabled")this.disabled=false;}
  appendChild(child){if(child.parentNode)child.remove();child.parentNode=this;this.children.push(child);return child;}
  insertBefore(child,anchor){if(child.parentNode)child.remove();const index=anchor?this.children.indexOf(anchor):this.children.length;child.parentNode=this;this.children.splice(index,0,child);return child;}
  removeChild(child){child.remove();return child;}
  append(...children){children.forEach(child=>this.appendChild(typeof child==="string"?this.ownerDocument.createTextNode(child):child));}
  replaceChildren(...children){this.textContent="";this.append(...children);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
  addEventListener(type,handler){(this.listeners[type]||(this.listeners[type]=[])).push(handler);}
  removeEventListener(type,handler){this.listeners[type]=(this.listeners[type]||[]).filter(fn=>fn!==handler);}
  dispatchEvent(event){event.target=event.target||this;event.currentTarget=this;event.preventDefault=event.preventDefault||function(){this.defaultPrevented=true;};if(this["on"+event.type])this["on"+event.type](event);for(const handler of (this.listeners[event.type]||[]).slice())handler(event);if(event.bubbles&&this.parentNode)this.parentNode.dispatchEvent(event);return !event.defaultPrevented;}
  click(){if(!this.disabled)this.dispatchEvent({type:"click",bubbles:true});}
  focus(){this.ownerDocument.activeElement=this;}
  blur(){this.ownerDocument.activeElement=null;this.dispatchEvent({type:"blur"});}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  contains(target){return target===this||this.children.some(child=>child.contains(target));}
  matches(selector){const attr=/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);if(attr)return this.getAttribute(attr[1])!==null&&(attr[2]===undefined||this.getAttribute(attr[1])===attr[2]);const id=/#([\w-]+)/.exec(selector),cls=/\.([\w-]+)/.exec(selector),tag=/^[\w-]+/.exec(selector);return (!id||this.id===id[1])&&(!cls||this.classList.contains(cls[1]))&&(!tag||this.tagName===tag[0].toUpperCase());}
  querySelectorAll(selector){return this.children.flatMap(child=>{const result=child.querySelectorAll(selector);return child.matches(selector)?[child,...result]:result;});}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return this.matches(selector)?this:this.parentNode&&this.parentNode.closest(selector);}
}
function documentFixture(){const document={};const body=new Element("body",document);Object.assign(document,{body,activeElement:null,visibilityState:"visible",createElement:tag=>new Element(tag,document),createTextNode:text=>{const node=new Element("#text",document);node.textContent=text;return node;},getElementById:id=>body.querySelector("#"+id),querySelector:selector=>body.querySelector(selector),querySelectorAll:selector=>body.querySelectorAll(selector),addEventListener:(...args)=>body.addEventListener(...args),removeEventListener:(...args)=>body.removeEventListener(...args),dispatchEvent:event=>body.dispatchEvent(event)});return document;}
function notebookDocument(){const document=documentFixture(),legacy=document.createElement("main");legacy.className="guitar-chordinator";document.body.appendChild(legacy);const root=document.createElement("main");root.id="song-notebook";root.hidden=true;document.body.appendChild(root);for(const id of ["notebook-header","notebook-status","notebook-settings","notebook-workspace","notebook-details","notebook-collection","notebook-sections","notebook-arrangement","notebook-editor","notebook-explore","notebook-reading"]){const host=document.createElement("div");host.id=id;root.appendChild(host);}return document;}
module.exports={Element,documentFixture,notebookDocument};
