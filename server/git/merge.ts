
export type TextFile = { path: string; content: string };
export type MergeConflict = { path: string; ours: string; theirs: string; base: string };

type Hunk = { start: number; end: number; lines: string[] };
function mapFiles(files: TextFile[]) { return new Map(files.map((file) => [file.path, file])); }

/** Build replacement hunks using an LCS edit script. This supports insertions/deletions, not only equal-length files. */
function hunks(base: string[], changed: string[]): Hunk[] {
  const n = base.length, m = changed.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i=n-1;i>=0;i--) for (let j=m-1;j>=0;j--) dp[i][j] = base[i] === changed[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const edits: Array<{i:number;j:number;kind:"del"|"ins";line?:string}> = [];
  let i=0,j=0;
  while(i<n || j<m){
    if(i<n && j<m && base[i]===changed[j]){i++;j++;continue;}
    if(j<m && (i===n || dp[i][j+1] > dp[i+1]?.[j])) { edits.push({i,j,kind:"ins",line:changed[j++]}); }
    else { edits.push({i,j,kind:"del"}); i++; }
  }
  const out:Hunk[]=[];
  for(const e of edits){
    const last=out[out.length-1];
    if(last && e.i<=last.end+1){ last.end=Math.max(last.end,e.i); if(e.kind==="ins") last.lines.push(e.line!); }
    else out.push({start:e.i,end:e.kind==="ins"?e.i:e.i+1,lines:e.kind==="ins"?[e.line!]:[]});
  }
  return out;
}

function mergeText(baseText:string, oursText:string, theirsText:string, path:string): {content?:string; conflict?:MergeConflict} {
  if(oursText===theirsText)return{content:oursText}; if(oursText===baseText)return{content:theirsText}; if(theirsText===baseText)return{content:oursText};
  const base=baseText.split("\n"), ours=oursText.split("\n"), theirs=theirsText.split("\n");
  const oh=hunks(base,ours), th=hunks(base,theirs); const all=[...oh.map(h=>({...h,side:"ours" as const})),...th.map(h=>({...h,side:"theirs" as const}))].sort((a,b)=>a.start-b.start || a.end-b.end);
  let cursor=0; const result:string[]=[];
  for(let k=0;k<all.length;){
    const first=all[k]; const group=[first]; let end=first.end; k++;
    const overlaps = (a:Hunk,b:Hunk) => a.start === a.end ? (b.start === b.end ? a.start === b.start : a.start >= b.start && a.start <= b.end) : b.start === b.end ? b.start >= a.start && b.start <= a.end : a.start < b.end && b.start < a.end;
    while(k<all.length && group.some((item) => overlaps(item, all[k]))){group.push(all[k]); end=Math.max(end,all[k].end); k++;}
    const oursH=group.filter(x=>x.side==="ours"), theirsH=group.filter(x=>x.side==="theirs");
    const same=(a:Hunk[],b:Hunk[])=>JSON.stringify(a.map(x=>x.lines))===JSON.stringify(b.map(x=>x.lines)) && a.reduce((s,x)=>s+x.start+":"+x.end,"")===b.reduce((s,x)=>s+x.start+":"+x.end,"");
    if(oursH.length&&theirsH.length){
      if(same(oursH,theirsH)){ result.push(...base.slice(cursor,first.start),...oursH.flatMap(x=>x.lines)); cursor=Math.max(cursor,end); continue; }
      const insertion = group.find((item) => item.start === item.end);
      const replacement = group.find((item) => item.start < item.end);
      if (insertion && replacement) { result.push(...base.slice(cursor, first.start), ...insertion.lines, ...replacement.lines); cursor = Math.max(cursor, end); continue; }
      return {conflict:{path,base:baseText,ours:oursText,theirs:theirsText}};
    }
    const h=oursH[0]||theirsH[0]; result.push(...base.slice(cursor,h.start),...h.lines); cursor=Math.max(cursor,h.end);
  }
  result.push(...base.slice(cursor)); return {content:result.join("\n")};
}

export function threeWayMerge(base:TextFile[],ours:TextFile[],theirs:TextFile[]){
  const b=mapFiles(base),o=mapFiles(ours),t=mapFiles(theirs),paths=[...new Set([...b.keys(),...o.keys(),...t.keys()])].sort(); const files:TextFile[]=[],conflicts:MergeConflict[]=[];
  for(const path of paths){const bc=b.get(path)?.content,oc=o.get(path)?.content,tc=t.get(path)?.content;
    if(oc===undefined&&tc===undefined)continue;
    if(bc===undefined){if(oc===undefined)files.push({path,content:tc!});else if(tc===undefined||oc===tc)files.push({path,content:oc});else conflicts.push({path,base:"",ours:oc,theirs:tc!});continue;}
    if(oc===undefined||tc===undefined){if(oc===bc)files.push({path,content:tc!});else if(tc===bc&&oc!==undefined)files.push({path,content:oc});else conflicts.push({path,base:bc,ours:oc??"",theirs:tc??""});continue;}
    const merged=mergeText(bc,oc,tc,path); if(merged.content!==undefined)files.push({path,content:merged.content}); else conflicts.push(merged.conflict!);
  }
  return {files,conflicts,clean:conflicts.length===0};
}
