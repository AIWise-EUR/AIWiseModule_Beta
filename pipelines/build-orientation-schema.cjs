// Run with LINKEDOM_MODULE set when LinkeDOM is outside this checkout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'..'),context={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'common-content.js'),'utf8'),context);
const result={};
for(const chapter of ['c1','c2','c3','map']){
 const name=chapter==='map'?'aiwise-c1-anatomy-2d':`aiwise-${chapter}-final`;
 const html=fs.readFileSync(path.join(root,'common',name+'.html'),'utf8'),doc=parseHTML(html).document;
 result[chapter]={html_sha256:require('node:crypto').createHash('sha256').update(html).digest('hex'),slots:Object.fromEntries(context.window.AIWiseCommonContent.catalog(doc,chapter).map(b=>[b.path,Object.fromEntries(Object.keys(b.fields).map(k=>[k,'']))]))};
}
module.exports=result;
if(require.main===module)fs.writeFileSync(path.join(__dirname,'orientation-schema.json'),JSON.stringify(result,null,2)+'\n');
