/* Optional color-quality engine, isolated from the page UI and loaded on demand. */
let ready;
function progress(message){self.postMessage({type:'progress',message});}
async function initialize(){
 progress('Loading the spectral calculation engine. The first load downloads scientific libraries; later calculations reuse them.');
 importScripts('https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.js');
 const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/',stdout:()=>{},stderr:()=>{}});
 progress('Loading numerical libraries…');
 await py.loadPackage(['numpy','scipy']);
 progress('Loading color samples and rendering methods…');
 const packageResponse=await fetch('assets/lighting/colour-0.4.7.bin');if(!packageResponse.ok)throw Error('The color-quality data package could not be loaded.');
 py.unpackArchive(await packageResponse.arrayBuffer(),'zip',{extractDir:'/home/pyodide/colour_vendor'});
 await py.runPythonAsync("import sys\nsys.path.insert(0, '/home/pyodide/colour_vendor')");
 importScripts('lighting-python.js?v=20261116');
 await py.runPythonAsync(self.LIGHTING_PYTHON_SOURCE);
 progress('Engine ready. Calculating color rendition…');return py;
}
self.onmessage=async({data})=>{const {id,payload}=data;try{if(!ready)ready=initialize().catch(e=>{ready=null;throw e;});const py=await ready;py.globals.set('request_json',JSON.stringify(payload));const result=JSON.parse(await py.runPythonAsync('json.dumps(calculate(json.loads(request_json)), allow_nan=False)'));self.postMessage({type:'result',id,result});}catch(e){self.postMessage({type:'error',id,error:String(e.message||e).split('\n').filter(Boolean).slice(-2).join(' ')});}};
