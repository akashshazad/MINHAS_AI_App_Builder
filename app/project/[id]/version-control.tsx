
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { userSafeError } from "@/lib/ui/error-message";

export default function VersionControl() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const [repoUrl, setRepoUrl] = useState("");
  const [branchName, setBranchName] = useState("");
  const [message, setMessage] = useState("");
  const [checkedOutBranchId, setCheckedOutBranchId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const status = trpc.projects.gitStatus.useQuery({ projectId }, { enabled: Number.isFinite(projectId) });
  const connect=trpc.projects.gitConnect.useMutation({onSuccess:()=>{setRepoUrl("");utils.projects.gitStatus.invalidate({projectId});}});
  const createBranch=trpc.projects.gitCreateBranch.useMutation({onSuccess:()=>{setBranchName("");utils.projects.gitStatus.invalidate({projectId});}});
  const commit=trpc.projects.gitCommit.useMutation({onSuccess:()=>{setMessage("");utils.projects.gitStatus.invalidate({projectId});}});
  const checkout=trpc.projects.gitCheckout.useMutation({onSuccess:(r)=>{setCheckedOutBranchId(r.branchId);Alert.alert("Checked out",r.name);utils.projects.gitStatus.invalidate({projectId});}});
  const pr=trpc.projects.gitCreatePullRequest.useMutation({onSuccess:(r)=>Alert.alert("Pull request",r.clean?`PR #${r.id} created.`:`${r.conflicts.length} conflict(s) detected.`)});
  const merge=trpc.projects.gitMerge.useMutation({onSuccess:()=>{utils.projects.gitStatus.invalidate({projectId});Alert.alert("Merged","The pull request was merged safely.")}});
  const fetchRemote=trpc.projects.gitFetch.useMutation({onSuccess:(r)=>{utils.projects.gitStatus.invalidate({projectId});Alert.alert("Remote status",`${r.branch}: ${r.syncState} (${r.remoteSha.slice(0,8)})`)}});
  const pull=trpc.projects.gitPull.useMutation({onSuccess:(r)=>{utils.projects.gitStatus.invalidate({projectId});Alert.alert("Pull",r.status==="conflicted"?`Conflicts detected: ${r.conflicts?.length??0}`:`Pull completed: ${r.status}`)}});
  const push=trpc.projects.gitPush.useMutation({onSuccess:(r)=>{utils.projects.gitStatus.invalidate({projectId});Alert.alert("Push complete",`Remote commit ${r.sha.slice(0,8)}`)}});
  if(status.isLoading)return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.primary}/></ScreenContainer>;
  const data=status.data; const branches=data?.branches??[]; const main=branches.find(b=>b.isDefault)??branches[0]; const activeBranchId=checkedOutBranchId??data?.activeGitBranchId??main?.id; const activeBranch=branches.find(b=>b.id===activeBranchId)??main;
  return <ScreenContainer className="px-4 pt-4"><Stack.Screen options={{title:"Version Control"}}/><ScrollView contentContainerStyle={{paddingBottom:40}}>
    <View className="rounded-3xl bg-[#111827] p-5"><Text className="text-xs font-bold tracking-[1.5px] text-[#8EF5D5]">10X VERSION CONTROL</Text><Text className="mt-2 text-2xl font-bold text-white">Branches, commits & safe merges</Text><Text className="mt-2 text-sm leading-5 text-[#D0D5DD]">Local snapshot-backed Git semantics are real and auditable. GitHub operations are enabled only when the server has a real GitHub token.</Text></View>
    <Card title="GitHub connection"><TextInput value={repoUrl} onChangeText={setRepoUrl} placeholder="https://github.com/owner/repository" placeholderTextColor="#98A2B3" style={styles.input}/><Button label={connect.isPending?"Connecting…":"Connect GitHub"} disabled={connect.isPending||repoUrl.trim().length<10} onPress={()=>connect.mutate({projectId,repositoryUrl:repoUrl.trim()})}/>{data?.provider.reason?<Text className="mt-2 text-xs text-warning">{data.provider.reason}</Text>:null}</Card>
    <Card title="Branches"><TextInput value={branchName} onChangeText={setBranchName} placeholder="feature/my-change" placeholderTextColor="#98A2B3" style={styles.input}/><Button label="Create branch from current workspace" disabled={createBranch.isPending||branchName.trim().length<1} onPress={()=>createBranch.mutate({projectId,name:branchName.trim()})}/><Text className="mt-3 text-xs text-muted">Active workspace branch: <Text className="font-semibold text-foreground">{activeBranch?.name??"Not initialized"}</Text></Text>{branches.map(b=><View key={b.id} className="mt-3 flex-row items-center rounded-2xl bg-background p-3"><View className="flex-1"><Text className="font-semibold text-foreground">{b.name}{b.isDefault?" · default":""}{b.id===activeBranchId?" · active":""}</Text><Text className="mt-1 text-xs text-muted">{b.protected?"Protected":"Unprotected"}</Text></View><Pressable onPress={()=>checkout.mutate({projectId,branchId:b.id})} style={styles.inlineAction}><Text className="font-semibold text-primary">Checkout</Text></Pressable></View>)}</Card>
    <Card title="Remote synchronization"><Text className="text-xs leading-5 text-muted">Fetch checks the remote SHA. Pull creates a safety snapshot and performs a three-way reconciliation; conflicts are never overwritten.</Text>{activeBranch?<View className="mt-2"><Text className="text-xs text-muted">Sync: {activeBranch.syncState??"unknown"}{activeBranch.remoteSha?` · ${activeBranch.remoteSha.slice(0,8)}`:""}</Text><View className="flex-row gap-2"><Button label="Fetch" disabled={fetchRemote.isPending} onPress={()=>fetchRemote.mutate({projectId,branchId:activeBranch.id})}/><Button label="Pull" disabled={pull.isPending} onPress={()=>pull.mutate({projectId,branchId:activeBranch.id})}/></View></View>:null}</Card>
    <Card title="Commit current workspace"><TextInput value={message} onChangeText={setMessage} placeholder="Describe the change" placeholderTextColor="#98A2B3" style={styles.input}/><Button label={`Commit to ${activeBranch?.name??"active branch"}`} disabled={!activeBranch||commit.isPending||message.trim().length<3} onPress={()=>activeBranch&&commit.mutate({projectId,branchId:activeBranch.id,message:message.trim()})}/><Button label={`Push ${activeBranch?.name??"active branch"}`} disabled={!activeBranch||push.isPending} onPress={()=>activeBranch&&push.mutate({projectId,branchId:activeBranch.id,message:message.trim()||"Sync workspace"})}/></Card>
    <Card title="Pull requests"><Text className="text-xs leading-5 text-muted">Create a local merge review between branches. Conflicts are detected with a deterministic three-way merge and are never silently overwritten.</Text>{branches.length>1&&main?<Button label="Create PR: first feature → default" onPress={()=>{const source=branches.find(b=>b.id!==main.id);if(source)pr.mutate({projectId,sourceBranchId:source.id,targetBranchId:main.id,title:`Merge ${source.name} into ${main.name}`,description:"Created from MINHAS AI Builder version control."})}}/>:null}{(data?.pullRequests??[]).map(p=><View key={p.id} className="mt-3 rounded-2xl bg-background p-3"><Text className="font-semibold text-foreground">{p.title}</Text><Text className="mt-1 text-xs text-muted">Status: {p.status}</Text>{p.status==="open"?<Pressable onPress={()=>merge.mutate({projectId,pullRequestId:p.id})} style={styles.inlineAction}><Text className="font-semibold text-primary">Merge safely</Text></Pressable>:null}</View>)}</Card>
    {(connect.error||createBranch.error||commit.error||checkout.error||pr.error||merge.error||fetchRemote.error||pull.error||push.error)?<Text className="mt-3 text-sm text-error">{userSafeError(connect.error||createBranch.error||commit.error||checkout.error||pr.error||merge.error||fetchRemote.error||pull.error||push.error)}</Text>:null}
  </ScrollView></ScreenContainer>;
}
function Card({title,children}:{title:string;children:any}){return <View className="mt-4 rounded-3xl bg-surface p-4"><Text className="text-sm font-bold text-foreground">{title}</Text>{children}</View>}
function Button({label,onPress,disabled}:{label:string;onPress:()=>void;disabled?:boolean}){return <Pressable onPress={onPress} disabled={disabled} style={[styles.button,disabled&&styles.disabled]}><Text className="font-bold text-[#101828]">{label}</Text></Pressable>}
  const styles=StyleSheet.create({input:{marginTop:12,minHeight:46,borderWidth:1,borderColor:"#D0D5DD",borderRadius:14,paddingHorizontal:13,color:"#101828",backgroundColor:"#fff"},button:{marginTop:12,minHeight:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#8EF5D5",paddingHorizontal:14},inlineAction:{paddingHorizontal:8,paddingVertical:6},disabled:{opacity:.5}});


