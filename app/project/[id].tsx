
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { adaptiveRefetchInterval } from "@/lib/query/adaptive-refresh";
import { userSafeError } from "@/lib/ui/error-message";

export default function ProjectWorkspace() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const query = trpc.projects.get.useQuery({ projectId }, { enabled: Number.isFinite(projectId) });
  const audit = trpc.projects.audit.useQuery({ projectId }, { enabled: Number.isFinite(projectId), refetchInterval: false });
  const utils = trpc.useUtils();
  const [section, setSection] = useState<"agent" | "factory" | "plan" | "files" | "activity">("agent");
  const [task, setTask] = useState("");
  const [pendingAgentRunId, setPendingAgentRunId] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  const [pipelineRunId, setPipelineRunId] = useState<number | null>(null);
  const [runtimeId, setRuntimeId] = useState<number | null>(null);

  const generate = trpc.projects.generateFiles.useMutation({ onSuccess: () => utils.projects.get.invalidate({ projectId }) });
  const regenerate = trpc.projects.regenerateFiles.useMutation({ onSuccess: () => { setNotice("Workspace regenerated safely. The previous workspace is preserved in a restore point."); utils.projects.get.invalidate({ projectId }); } });
  const validate = trpc.projects.validate.useMutation();
  const updateFile = trpc.projects.updateFile.useMutation({ onSuccess: () => utils.projects.get.invalidate({ projectId }) });
  const [buildEngine, setBuildEngine] = useState<"auto" | "native" | "expo">("auto");
  const build = trpc.projects.build.useMutation({ onSuccess: (result) => { setLastJobId(result.jobId); setNotice(result.configured ? `Build ${result.status}. Refresh status after the isolated worker responds.` : result.error ?? "Build required service is unavailable."); utils.projects.get.invalidate({ projectId }); } });
  const startPreview = trpc.projects.startPreview.useMutation({ onSuccess: (result) => { if (result.runtimeId) setRuntimeId(result.runtimeId); setNotice(result.configured ? `Preview runtime ${result.status}.` : result.error ?? "Preview required service is unavailable."); utils.projects.get.invalidate({ projectId }); } });
  const previewStatus = trpc.projects.previewStatus.useQuery({ projectId, runtimeId: runtimeId ?? 0 }, { enabled: Boolean(runtimeId), refetchInterval: (query) => runtimeId ? adaptiveRefetchInterval(query.state.data?.status, { activeMs: 4000, maxMs: 30000 }) : false });
  const exportZip = trpc.projects.exportZip.useMutation({ onSuccess: async (result) => { setNotice(`ZIP ready: ${result.fileName}`); await Linking.openURL(result.signedUrl); } });
  const createSnapshot = trpc.projects.createSnapshot.useMutation({ onSuccess: () => { setNotice("Snapshot created."); utils.projects.get.invalidate({ projectId }); } });
  const agentTask = trpc.projects.agentTask.useMutation({ onSuccess: (result) => { if (result.applied) { setPendingAgentRunId(null); setTask(""); setNotice(`AI changes applied: ${result.patches.length} file(s). Restore point #${result.snapshotId} created.`); } else { setPendingAgentRunId(result.runId); setNotice(`AI prepared ${result.patches.length} proposed file change(s). Review the preview before applying.`); } utils.projects.get.invalidate({ projectId }); } });
  const applyAgent = trpc.projects.agentTask.useMutation({ onSuccess: (result) => { setPendingAgentRunId(null); setTask(""); setNotice(`AI changes applied: ${result.patches.length} file(s). Restore point #${result.snapshotId} created.`); utils.projects.get.invalidate({ projectId }); } });
  const review = trpc.projects.review.useMutation({ onSuccess: (result) => { setNotice(result.appliedPaths?.length ? `AI auto-fix applied to ${result.appliedPaths.join(", ")}.` : result.summary); utils.projects.get.invalidate({ projectId }); } });
  const deploy = trpc.projects.deploy.useMutation({ onSuccess: (result) => { const configured = "configured" in result && result.configured; setNotice(configured ? `Deployment ${result.status}.` : ("error" in result ? result.error ?? "Deployment provider rejected the request." : "Deployment required service is unavailable.")); utils.projects.get.invalidate({ projectId }); } });
  const softwareFactory = trpc.projects.softwareFactory.useMutation({ onSuccess: (result) => { setNotice(`Software Factory completed ${result.reports.length} specialist reviews. Findings are advisory; no files were changed.`); utils.projects.get.invalidate({ projectId }); } });
  const autonomous = trpc.projects.startAutonomousRun.useMutation({ onSuccess: (result) => { if (result?.id) setPipelineRunId(result.id); setNotice("Autonomous pipeline started. It will stop at any execution gate that does not have real verification evidence."); utils.projects.get.invalidate({ projectId }); } });
  const pipelineStatus = trpc.projects.autonomousRunStatus.useQuery({ projectId, runId: pipelineRunId ?? 0, advance: Boolean(pipelineRunId) }, { enabled: Boolean(pipelineRunId), refetchInterval: (query) => pipelineRunId ? adaptiveRefetchInterval(query.state.data?.status, { activeMs: 5000, maxMs: 30000 }) : false });
  const buildStatus = trpc.projects.buildStatus.useQuery({ projectId, jobId: lastJobId ?? 0 }, { enabled: Boolean(lastJobId), refetchInterval: (query) => lastJobId ? adaptiveRefetchInterval(query.state.data?.status, { activeMs: 4000, maxMs: 30000 }) : false });

  const selectedFile = useMemo(() => query.data?.files.find((file) => file.path === selectedPath) ?? query.data?.files[0], [query.data?.files, selectedPath]);
  useEffect(() => {
    const file = query.data?.files.find((item) => item.path === selectedPath) ?? query.data?.files[0];
    if (file) { setSelectedPath(file.path); setDraft(file.content); }
  }, [query.data?.files, selectedPath]);

  if (query.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.primary} /></ScreenContainer>;
  if (query.error || !query.data) return <ScreenContainer className="p-5"><Text className="text-lg font-bold text-foreground">Unable to load project</Text><Text className="mt-2 text-sm text-muted">{query.error?.message ?? "Project not found"}</Text></ScreenContainer>;
  const { project, plan, files, events, snapshots, buildJobs, reviews, deployments, pipelineRuns } = query.data;
  const latestPassedBuild = buildJobs.find((job) => job.status === "passed");
  const save = () => { if (selectedFile && draft !== selectedFile.content) updateFile.mutate({ projectId, path: selectedFile.path, content: draft }); };
  const actionError = userSafeError(generate.error) || userSafeError(build.error) || userSafeError(exportZip.error) || userSafeError(review.error) || userSafeError(deploy.error);

  return (
    <ScreenContainer className="px-4 pt-4">
      <Stack.Screen options={{ title: project.name }} />
        <View className="flex-row items-center">
        <Pressable onPress={() => router.back()} style={styles.iconButton}><IconSymbol name="chevron.left.forwardslash.chevron.right" size={18} color={colors.muted} /></Pressable>
        <View className="ml-3 flex-1"><Text className="text-lg font-bold text-foreground" numberOfLines={1}>{project.name}</Text><Text className="mt-0.5 text-xs capitalize text-muted">{project.status.replaceAll("_", " ")} · {project.framework}</Text></View>
        <View className="rounded-full bg-warning/15 px-2.5 py-1"><Text className="text-[10px] font-bold text-warning">{project.buildStatus.replaceAll("_", " ")}</Text></View><Pressable onPress={() => router.push(`/project/${projectId}/studio`)} style={styles.headerAction}><Text className="text-[10px] font-bold text-primary">Studio</Text></Pressable><Pressable onPress={() => router.push(`/project/${projectId}/version-control`)} style={styles.headerAction}><Text className="text-[10px] font-bold text-primary">Git</Text></Pressable>
      </View>
      <View className="mt-5 flex-row rounded-2xl bg-surface p-1"><Tab label="Agent" active={section === "agent"} onPress={() => setSection("agent")} /><Tab label="Factory" active={section === "factory"} onPress={() => setSection("factory")} /><Tab label="Plan" active={section === "plan"} onPress={() => setSection("plan")} /><Tab label={`Files ${files.length ? `(${files.length})` : ""}`} active={section === "files"} onPress={() => setSection("files")} /><Tab label="Activity" active={section === "activity"} onPress={() => setSection("activity")} /></View>

      {section === "agent" ? <ScrollView contentContainerStyle={styles.scroll}>
        <View className="mt-5 rounded-3xl bg-[#111827] p-5">
          <Text className="text-xs font-semibold tracking-[1.5px] text-[#8EF5D5]">MINHAS AI AGENT</Text>
          <Text className="mt-2 text-2xl font-bold text-white">Build with conversation</Text>
          <Text className="mt-2 text-sm leading-5 text-[#D0D5DD]">Describe the change in natural language. The coding agent reads the approved workspace, creates a restore point, applies bounded file patches, and records the run for audit.</Text>
          <TextInput value={task} onChangeText={setTask} multiline placeholder="e.g. Add a customer search screen with barcode scanning and empty/loading/error states" placeholderTextColor="#98A2B3" textAlignVertical="top" style={styles.agentInput} />
          <Pressable onPress={() => agentTask.mutate({ projectId, instruction: task.trim(), mode: "preview" })} disabled={agentTask.isPending || task.trim().length < 4} style={[styles.agentButton, (agentTask.isPending || task.trim().length < 4) && styles.disabled]}>
            {agentTask.isPending ? <ActivityIndicator color="#101828" /> : <><IconSymbol name="sparkles" size={17} color="#101828" /><Text className="ml-2 font-bold text-[#101828]">{agentTask.isPending ? "Preparing preview…" : "Preview AI changes"}</Text></>}
          </Pressable>
        </View>
        <Text className="mt-6 text-xs font-semibold tracking-[1.4px] text-muted">QUICK TASKS</Text>
        <View className="mt-3 gap-2">
          {["Audit the workspace for missing requirements and fix safe issues.", "Improve the home screen UX without changing business behavior.", "Add complete loading, empty, error, and retry states to the current flow.", "Review security risks and fix safe client-side issues without inventing credentials."].map((item) => <Pressable key={item} onPress={() => setTask(item)} style={styles.quickTask}><Text className="flex-1 text-sm leading-5 text-foreground">{item}</Text><IconSymbol name="chevron.right" size={17} color={colors.muted} /></Pressable>)}
        </View>
        {pendingAgentRunId ? <View className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4"><Text className="text-sm font-bold text-foreground">AI preview ready</Text><Text className="mt-1 text-xs leading-5 text-muted">The workspace has not been modified yet. Review the proposed changes, then explicitly apply them.</Text><View className="mt-3 flex-row gap-2"><Pressable onPress={() => applyAgent.mutate({ projectId, instruction: "Apply the approved preview", mode: "apply", runId: pendingAgentRunId })} disabled={applyAgent.isPending} style={[styles.agentButton, { flex: 1, marginTop: 0 }]}><Text className="font-bold text-[#101828]">{applyAgent.isPending ? "Applying…" : "Apply preview"}</Text></Pressable><Pressable onPress={() => setPendingAgentRunId(null)} disabled={applyAgent.isPending} style={[styles.quickTask, { flex: 1, justifyContent: "center" }]}><Text className="font-semibold text-foreground">Discard</Text></Pressable></View></View> : null}
        <View className="mt-6 rounded-2xl bg-primary/10 p-4"><Text className="text-sm font-semibold text-foreground">Safety boundary</Text><Text className="mt-1 text-xs leading-5 text-muted">AI previews never modify the workspace. Applying an approved preview creates a restore point first; stale previews are rejected if affected files changed. Only existing text/code files may be patched. Secrets, dependency lockfiles, binaries, and unsafe paths are rejected.</Text></View>
        <Text className="mt-6 text-xs font-semibold tracking-[1.4px] text-muted">RECENT AGENT RUNS</Text>
        {(query.data?.aiRuns ?? []).slice(0, 8).map((run) => <View key={run.id} className="mt-2 rounded-2xl bg-surface p-4"><View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">{run.agentKey}</Text><Text className="text-xs font-semibold text-muted">{run.status}</Text></View><Text className="mt-1 text-xs leading-5 text-muted" numberOfLines={3}>{run.prompt}</Text>{run.filesChangedJson ? <Text className="mt-2 text-xs text-primary">Changed: {run.filesChangedJson}</Text> : null}</View>)}
        {agentTask.error ? <Text className="mt-3 text-sm text-error">{agentTask.error.message}</Text> : null}
      </ScrollView> : null}

      {section === "factory" ? <ScrollView contentContainerStyle={styles.scroll}>
        <View className="mt-5 rounded-3xl bg-[#111827] p-5">
          <Text className="text-xs font-semibold tracking-[1.5px] text-[#8EF5D5]">MINHAS AI SOFTWARE FACTORY</Text>
          <Text className="mt-2 text-2xl font-bold text-white">Six specialist agents. One verified workflow.</Text>
          <Text className="mt-2 text-sm leading-5 text-[#D0D5DD]">Run a controlled audit across Product, Architecture, UI/UX, QA, Security, and Release. This audit never edits your workspace; implementation remains behind the existing preview → explicit apply safety gate.</Text>
          <TextInput value={task} onChangeText={setTask} multiline placeholder="e.g. Audit this app for production readiness and identify every missing requirement" placeholderTextColor="#98A2B3" textAlignVertical="top" style={styles.agentInput} />
          <Pressable onPress={() => softwareFactory.mutate({ projectId, instruction: task.trim() })} disabled={softwareFactory.isPending || task.trim().length < 4} style={[styles.agentButton, (softwareFactory.isPending || task.trim().length < 4) && styles.disabled]}>
            {softwareFactory.isPending ? <ActivityIndicator color="#101828" /> : <><IconSymbol name="sparkles" size={17} color="#101828" /><Text className="ml-2 font-bold text-[#101828]">Run 10X Software Factory</Text></>}
          </Pressable>
        </View>
        {softwareFactory.data ? <View className="mt-5 gap-3">{softwareFactory.data.reports.map((report) => <View key={report.role} className="rounded-2xl bg-surface p-4"><View className="flex-row items-center justify-between"><Text className="text-sm font-bold capitalize text-foreground">{report.role} agent</Text><Text className="text-[10px] font-bold text-primary">COMPLETED</Text></View><Text className="mt-2 text-sm leading-5 text-foreground">{report.summary}</Text>{report.findings.slice(0,4).map((item) => <Text key={item} className="mt-2 text-xs leading-5 text-muted">• {item}</Text>)}</View>)}</View> : null}
        {softwareFactory.error ? <Text className="mt-3 text-sm text-error">{softwareFactory.error.message}</Text> : null}
      </ScrollView> : null}

      {section === "plan" ? <ScrollView contentContainerStyle={styles.scroll}>
        <View className="mt-5 rounded-3xl bg-surface p-5 shadow-sm"><Text className="text-xs font-semibold tracking-[1.4px] text-primary">AI PROJECT PLAN · VALIDATED</Text><Text className="mt-2 text-2xl font-bold text-foreground">{plan.summary}</Text><Text className="mt-3 text-sm leading-5 text-muted">This plan is persisted with an editable workspace, initial restore point, main branch, and local commit. Review it before making changes.</Text></View>
        <PlanSection title="Requirements" items={plan.requirements} />
        <PlanSection title="Pages & components" items={[...plan.pages, ...plan.components]} />
        <PlanSection title="Data & APIs" items={[...plan.database, ...plan.apis]} empty="No database or API requirements detected yet." />
        <PlanSection title="Testing strategy" items={plan.testingStrategy} />
        <Text className="mt-6 text-xs font-semibold tracking-[1.4px] text-muted">WORKSPACE ACTIONS</Text>
        <View className="mt-3 gap-2">
          <ActionButton icon="sparkles" label={autonomous.isPending ? "Starting autonomous pipeline…" : "Run autonomous software factory"} onPress={() => autonomous.mutate({ projectId })} disabled={autonomous.isPending || Boolean(pipelineRunId)} />
          <ActionButton icon="sparkles" label={files.length ? (regenerate.isPending ? "Regenerating workspace…" : "Regenerate workspace safely") : generate.isPending ? "Initializing legacy workspace…" : "Initialize legacy workspace"} onPress={() => files.length ? Alert.alert("Regenerate workspace", "A restore point will be created before replacing the current generated files. Continue?", [{ text: "Cancel", style: "cancel" }, { text: "Regenerate", style: "destructive", onPress: () => regenerate.mutate({ projectId, confirm: true }) }]) : generate.mutate({ projectId })} disabled={generate.isPending || regenerate.isPending} />
          <View className="mt-2 rounded-2xl border border-border bg-surface p-3">
            <Text className="text-xs font-bold uppercase tracking-[1.2px] text-muted">Build Engine</Text>
            <View className="mt-2 flex-row gap-2">
              {(["auto", "native", "expo"] as const).map((engine) => <Pressable key={engine} onPress={() => setBuildEngine(engine)} style={[styles.engineChip, buildEngine === engine && styles.engineChipActive]}><Text className="text-xs font-bold text-foreground">{engine === "auto" ? "Auto → Native" : engine === "native" ? "MINHAS Native" : "Expo / EAS"}</Text></Pressable>)}
            </View>
            <Text className="mt-2 text-xs leading-5 text-muted">Native is primary. Expo/EAS remains available as an optional compatibility engine.</Text>
          </View>
          <ActionButton icon="play.fill" label={build.isPending ? "Queueing build…" : `Build with ${buildEngine === "auto" ? "Auto → Native" : buildEngine === "native" ? "MINHAS Native" : "Expo / EAS"}`} onPress={() => build.mutate({ projectId, engine: buildEngine })} disabled={!files.length || build.isPending} />
          <ActionButton icon="display" label={startPreview.isPending ? "Starting preview runtime…" : previewStatus.data?.status === "live" ? "Preview runtime is live" : "Start real preview runtime"} onPress={() => startPreview.mutate({ projectId, jobId: lastJobId ?? latestPassedBuild?.id ?? 0 })} disabled={!latestPassedBuild || startPreview.isPending || Boolean(runtimeId && previewStatus.data?.status === "live")} />
          <ActionButton icon="arrow.up.right.square" label={exportZip.isPending ? "Creating secure ZIP…" : "Export secure ZIP"} onPress={() => exportZip.mutate({ projectId })} disabled={!files.length || exportZip.isPending} />
          <ActionButton icon="checkmark.circle.fill" label={createSnapshot.isPending ? "Saving snapshot…" : "Create restore snapshot"} onPress={() => createSnapshot.mutate({ projectId, label: `Manual snapshot ${new Date().toLocaleString()}` })} disabled={!files.length || createSnapshot.isPending} />
          <View className="flex-row gap-2"><View className="flex-1"><ActionButton icon="doc.text.fill" label={review.isPending ? "Reviewing…" : "AI review"} onPress={() => review.mutate({ projectId, mode: "review" })} disabled={!files.length || review.isPending} /></View><View className="flex-1"><ActionButton icon="sparkles" label={review.isPending ? "Fixing…" : "AI auto-fix"} onPress={() => review.mutate({ projectId, mode: "fix" })} disabled={!files.length || review.isPending} /></View></View>
          <ActionButton icon="arrow.up.right.square" label={deploy.isPending ? "Queueing deployment…" : project.buildStatus === "passed" ? "Deploy" : "Deploy after passed build"} onPress={() => deploy.mutate({ projectId, provider: "managed" })} disabled={project.buildStatus !== "passed" || deploy.isPending} />
        </View>
        {pipelineRunId ? <View className="mt-3 rounded-2xl bg-primary/10 p-4"><Text className="text-sm font-semibold text-foreground">Autonomous pipeline #{pipelineRunId}</Text><Text className="mt-1 text-xs leading-5 text-muted">{pipelineStatus.data?.status ?? "starting"} · current step: {pipelineStatus.data?.currentStep ?? "requirements"}</Text>{pipelineStatus.data?.error ? <Text className="mt-2 text-xs leading-5 text-warning">{pipelineStatus.data.error}</Text> : null}<Text className="mt-2 text-xs text-muted">Retries are bounded at five. Generated code never executes in the API process.</Text></View> : null}
        {lastJobId ? <View className="mt-3 rounded-2xl bg-primary/10 p-4"><Text className="text-sm font-semibold text-foreground">Isolated build status: {buildStatus.data?.status ?? "queued"}</Text><Text className="mt-1 text-xs leading-5 text-muted">{buildStatus.data?.previewUrl ? "Build provider supplied a preview candidate; it must pass runtime health verification before it is shown as live." : "Generated code is not executed in this API process."}</Text></View> : null}
        {runtimeId ? <View className="mt-3 rounded-2xl bg-success/10 p-4"><Text className="text-sm font-semibold text-foreground">Preview runtime: {previewStatus.data?.status ?? "starting"}</Text><Text className="mt-1 text-xs leading-5 text-muted">Health: {previewStatus.data?.healthStatus ?? "unknown"}</Text>{previewStatus.data?.previewUrl ? <Pressable onPress={() => Linking.openURL(previewStatus.data!.previewUrl!)}><Text className="mt-2 font-semibold text-primary">Open runtime preview</Text></Pressable> : null}{previewStatus.data?.error ? <Text className="mt-2 text-xs text-error">{previewStatus.data.error}</Text> : null}</View> : null}
        {project.previewUrl ? <Pressable onPress={() => Linking.openURL(project.previewUrl!)} style={styles.previewCard}><Text className="text-sm font-semibold text-foreground">Verified live preview</Text><Text className="mt-1 text-xs font-semibold text-success">Open preview</Text></Pressable> : null}
        {notice ? <View className="mt-3 rounded-2xl bg-surface p-4"><Text className="text-sm leading-5 text-foreground">{notice}</Text></View> : null}
        {audit.data ? <View className="mt-3 rounded-2xl bg-surface p-4"><View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Feature audit</Text><Text className="text-xs font-bold text-primary">{audit.data.live} live · {audit.data.blocked} blocked · {audit.data.degraded} degraded</Text></View><Text className="mt-1 text-xs leading-5 text-muted">Every status is based on persisted evidence or provider configuration.</Text></View> : null}
        {actionError ? <Text className="mt-3 text-sm text-error">{actionError}</Text> : null}
        <View className="mt-4 rounded-2xl bg-warning/10 p-4"><Text className="text-sm font-semibold text-foreground">Deployment boundary</Text><Text className="mt-1 text-xs leading-5 text-muted">Builds execute only through a configured isolated build service. ZIP export uses server-side storage. Deployment requires a passed build and a configured deployment service; no fake preview or deployment is shown.</Text></View>
      </ScrollView> : null}

      {section === "files" ? <View className="mt-4 flex-1"><View className="flex-row items-center justify-between"><Text className="text-xs font-semibold tracking-[1.4px] text-muted">FILE EXPLORER</Text><View className="flex-row gap-3"><Pressable onPress={() => review.mutate({ projectId, mode: "review" })}><Text className="font-semibold text-primary">Review</Text></Pressable><Pressable onPress={() => validate.mutate({ projectId })}><Text className="font-semibold text-primary">{validate.isPending ? "Checking…" : "Validate"}</Text></Pressable></View></View><View className="mt-3 flex-1 flex-row rounded-3xl bg-surface p-3"><FlatList style={styles.fileList} data={files} keyExtractor={(file) => file.path} renderItem={({ item }) => <Pressable onPress={() => setSelectedPath(item.path)} style={({ pressed }) => [styles.fileRow, item.path === selectedFile?.path && styles.fileRowActive, pressed && { opacity: 0.7 }]}><IconSymbol name="doc.text.fill" size={15} color={item.path === selectedFile?.path ? colors.primary : colors.muted} /><Text className="ml-2 flex-1 text-xs text-foreground" numberOfLines={1}>{item.path}</Text></Pressable>} ListEmptyComponent={<Text className="p-2 text-xs text-muted">Generate files from the Plan tab.</Text>} /><View className="ml-3 flex-1"><View className="flex-row items-center justify-between"><Text className="text-xs font-semibold text-foreground" numberOfLines={1}>{selectedFile?.path ?? "Select a file"}</Text><Pressable onPress={save} disabled={!selectedFile || draft === selectedFile?.content}><Text className={`text-xs font-bold ${draft !== selectedFile?.content ? "text-primary" : "text-muted"}`}>Save</Text></Pressable></View><TextInput value={draft} onChangeText={setDraft} multiline editable={Boolean(selectedFile)} textAlignVertical="top" style={[styles.editor, { color: colors.foreground, borderColor: colors.border }]} placeholder="Select a file from the explorer" placeholderTextColor={colors.muted} /></View></View>{validate.data ? <View className={`mt-3 rounded-2xl p-4 ${validate.data.status === "ready" ? "bg-success/10" : "bg-error/10"}`}><Text className="text-sm font-semibold text-foreground">Validation {validate.data.status}</Text>{[...validate.data.errors, ...validate.data.warnings].map((item) => <Text key={item} className="mt-1 text-xs leading-5 text-muted">• {item}</Text>)}</View> : null}</View> : null}

      {section === "activity" ? <View className="mt-4 flex-1"><Text className="text-xs font-semibold tracking-[1.4px] text-muted">EVENTS</Text><FlatList className="mt-2" data={events} keyExtractor={(event) => String(event.id)} renderItem={({ item }) => <View className="border-b border-border py-4"><Text className="text-sm text-foreground">{item.message}</Text><Text className="mt-1 text-xs uppercase text-muted">{item.type.replaceAll("_", " ")}</Text></View>} ListEmptyComponent={<Text className="mt-5 text-sm text-muted">No activity yet.</Text>} /><Text className="mt-4 text-xs font-semibold tracking-[1.4px] text-muted">SNAPSHOTS</Text><FlatList className="mt-2" data={snapshots} keyExtractor={(snapshot) => String(snapshot.id)} renderItem={({ item }) => <View className="flex-row items-center border-b border-border py-3"><View className="flex-1"><Text className="text-sm text-foreground">{item.label}</Text><Text className="mt-1 text-xs text-muted">{item.reason}</Text></View><Pressable onPress={() => utils.projects.get.invalidate({ projectId })}><Text className="text-xs font-semibold text-muted">#{item.id}</Text></Pressable></View>} ListEmptyComponent={<Text className="mt-3 text-sm text-muted">No snapshots yet.</Text>} /><Text className="mt-4 text-xs font-semibold tracking-[1.4px] text-muted">AUTONOMOUS RUNS</Text><FlatList className="mt-2" data={pipelineRuns} keyExtractor={(run) => String(run.id)} renderItem={({ item }) => <View className="border-b border-border py-3"><Text className="text-sm text-foreground">Run #{item.id} · {item.status}</Text><Text className="mt-1 text-xs text-muted">Current step: {item.currentStep ?? "—"}{item.error ? ` · ${item.error}` : ""}</Text></View>} ListEmptyComponent={<Text className="mt-3 text-sm text-muted">No autonomous runs yet.</Text>} /><Text className="mt-4 text-xs leading-5 text-muted">{buildJobs.length} build job(s), {reviews.length} AI review(s), {deployments.length} deployment record(s), and {pipelineRuns.length} autonomous run(s) persisted for this project.</Text></View> : null}
    </ScreenContainer>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text className={`text-xs font-semibold ${active ? "text-[#101828]" : "text-muted"}`}>{label}</Text></Pressable>; }
function PlanSection({ title, items, empty }: { title: string; items: string[]; empty?: string }) { return <View className="mt-5"><Text className="text-xs font-semibold tracking-[1.4px] text-muted">{title.toUpperCase()}</Text><View className="mt-2 rounded-2xl bg-surface p-4">{items.length ? items.map((item) => <Text key={item} className="mb-2 text-sm leading-5 text-foreground">• {item}</Text>) : <Text className="text-sm text-muted">{empty ?? "No items"}</Text>}</View></View>; }
function ActionButton({ icon, label, onPress, disabled }: { icon: any; label: string; onPress: () => void; disabled?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.actionButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><IconSymbol name={icon} size={17} color={disabled ? "#98A2B3" : "#101828"} /><Text className={`ml-2 flex-1 text-sm font-semibold ${disabled ? "text-muted" : "text-foreground"}`}>{label}</Text><IconSymbol name="chevron.right" size={16} color={disabled ? "#98A2B3" : "#667085"} /></Pressable>; }

const styles = StyleSheet.create({
  engineChip: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#D0D5DD", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  engineChipActive: { borderWidth: 2, borderColor: "#059669" },
  scroll: { paddingBottom: 30 },
  iconButton: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: "#E4E7EC", alignItems: "center", justifyContent: "center" },
  headerAction: { marginLeft: 8, borderRadius: 999, backgroundColor: "rgba(54,224,176,0.10)", paddingHorizontal: 12, paddingVertical: 8 },
  actionButton: { minHeight: 48, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E7EC", flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  previewCard: { marginTop: 12, borderRadius: 16, backgroundColor: "rgba(34,197,94,0.10)", padding: 16 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.6 },
  tab: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#36E0B0" },
  fileList: { width: "35%", maxWidth: 180 },
  fileRow: { minHeight: 35, borderRadius: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  fileRowActive: { backgroundColor: "rgba(54,224,176,0.12)" },
  editor: { marginTop: 10, flex: 1, minHeight: 360, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 18, fontFamily: "monospace" },
  agentInput: { marginTop: 18, minHeight: 130, borderRadius: 18, backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151", padding: 14, color: "#FFFFFF", fontSize: 15, lineHeight: 22 },
  agentButton: { marginTop: 12, minHeight: 48, borderRadius: 15, backgroundColor: "#8EF5D5", alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 16 },
  quickTask: { minHeight: 58, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E7EC", paddingHorizontal: 15, paddingVertical: 11, flexDirection: "row", alignItems: "center" },
});
