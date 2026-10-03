/* Loads the real bachelor – course registry into a test window. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const script=new vm.Script(fs.readFileSync(path.join(root,'workspace/course-registry.js'),'utf8'));
function registry(window={}){
 script.runInNewContext({window});
 window.AIWiseCourseRegistry.use(JSON.parse(fs.readFileSync(path.join(root,'common/courses/registry.json'),'utf8')));
 return window.AIWiseCourseRegistry;
}
// Every workspace script loaded through vm.runInNewContext after this call sees the registry on its window.
registry.everywhere=()=>{const run=vm.runInNewContext;vm.runInNewContext=(code,context,...rest)=>{if(context?.window&&!context.window.AIWiseCourseRegistry)registry(context.window);return run(code,context,...rest);};};
module.exports=registry;
