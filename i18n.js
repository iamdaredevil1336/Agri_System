// AgriSystem i18n
const I18N_STORAGE_KEY="agri_lang";
const DEFAULT_LANG="en";
const SUPPORTED_LANGS=["en","hi","gu"];
let currentLang=localStorage.getItem(I18N_STORAGE_KEY)||DEFAULT_LANG;
const cache={};
const deepGet=(o,p)=>p.split(".").reduce((a,k)=>a&&a[k]!=null?a[k]:null,o);
async function loadLanguage(lang){if(cache[lang])return cache[lang];const r=await fetch(`translations/${lang}.json`);cache[lang]=await r.json();return cache[lang];}
function apply(dict){
document.querySelectorAll("[data-i18n]").forEach(e=>{const v=deepGet(dict,e.dataset.i18n);if(v!=null)e.textContent=v;});
document.querySelectorAll("[data-i18n-placeholder]").forEach(e=>{const v=deepGet(dict,e.dataset.i18nPlaceholder);if(v!=null)e.placeholder=v;});
document.documentElement.lang=currentLang;
}
async function setLanguage(lang){currentLang=SUPPORTED_LANGS.includes(lang)?lang:DEFAULT_LANG;localStorage.setItem(I18N_STORAGE_KEY,currentLang);apply(await loadLanguage(currentLang));}
document.addEventListener("DOMContentLoaded",()=>{document.querySelectorAll("#langSelect,.lang-select").forEach(s=>s.addEventListener("change",e=>setLanguage(e.target.value)));setLanguage(currentLang);});
window.i18n={setLanguage};
