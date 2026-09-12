
import fs from "node:fs";
import path from "node:path";

export type SecurityFinding={severity:"critical"|"high"|"medium";rule:string;file:string;line:number;message:string};
const secretPatterns=[/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,/AKIA[0-9A-Z]{16}/,/AIza[0-9A-Za-z_-]{20,}/,/\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i];
const shellPatterns=[/exec\s*\(/,/execSync\s*\(/,/spawn\([^,]+,[^)]*shell\s*:\s*true/];
const walk=(root:string,dir:string,out:string[]=[]):string[]=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(["node_modules",".git","dist",".expo"].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(root,p,out);else if(/\.(ts|tsx|js|mjs|json|yml|yaml|env|md)$/.test(e.name))out.push(p)}return out};
export function scanSourceSecurity(root=process.cwd()):SecurityFinding[]{const findings:SecurityFinding[]=[];for(const file of walk(root,root)){let text="";try{text=fs.readFileSync(file,"utf8")}catch{continue}const lines=text.split(/\r?\n/);lines.forEach((line,i)=>{for(const p of secretPatterns)if(p.test(line)&&!/process\.env\./.test(line)&&!/(example|placeholder|sample)/i.test(line))findings.push({severity:"high",rule:"hardcoded-secret",file:path.relative(root,file),line:i+1,message:"Possible hardcoded credential/secret."});for(const p of shellPatterns)if(p.test(line))findings.push({severity:"high",rule:"unsafe-process-execution",file:path.relative(root,file),line:i+1,message:"Potential unsafe process execution pattern; verify allowlisting and shell:false."});if(/docker.*--privileged|docker.*--pid=host|--net=host/.test(line))findings.push({severity:"critical",rule:"dangerous-docker-flag",file:path.relative(root,file),line:i+1,message:"Dangerous Docker isolation flag detected."})})}return findings}


