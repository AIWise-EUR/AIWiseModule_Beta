/* Publication-cycle names; dates always use the Netherlands time zone. */
(() => {
 'use strict';
 const date=value=>{if(!value||Number.isNaN(new Date(value).getTime()))return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));return ['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-');};
 const time=value=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Europe/Amsterdam',dateStyle:'medium',timeStyle:'short'})+' (NL)':'';
 function start(version,versions){const earlier=versions.filter(v=>!version?.id||v.number<version.number);return version?.started_at||earlier.find(v=>v.published_at)?.published_at||earlier.at(-1)?.created_at||version?.created_at;}
 function name(version,versions=[]){const number=version?.number||Math.max(0,...versions.map(v=>Number(v.number)))+1,stamp=date(start(version,versions));return 'V'+number+(stamp?'_'+stamp:'');}
 window.AIWiseVersionLabels=Object.freeze({date,time,start,name});
})();
