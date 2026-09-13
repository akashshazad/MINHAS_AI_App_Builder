import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { captureFromCamera, LocalAttachment, pickFiles, pickFromGallery, readBase64 } from "@/lib/attachments";
import { trpc } from "@/lib/trpc";

const DRAFT_KEY = "minhas.prompt.draft.v2";

type UploadedAttachment = { name: string; mimeType: string; url: string; textContent?: string };

export default function HomeScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [idea, setIdea] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const idempotencyPrompt = useRef("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const createPlan = trpc.projects.createPlan.useMutation({ onSuccess: ({ projectId }) => router.push({ pathname: "/project/[id]", params: { id: String(projectId) } }) });
  const upload = trpc.media.upload.useMutation();
  const transcribe = trpc.media.transcribe.useMutation();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const busy = authLoading || createPlan.isPending || isUploading || transcribe.isPending;

  useEffect(() => { AsyncStorage.getItem(DRAFT_KEY).then((value) => { if (value) setIdea(value); }).catch(() => undefined); }, []);
  useEffect(() => { AsyncStorage.setItem(DRAFT_KEY, idea).catch(() => undefined); }, [idea]);

  const addAttachments = (items: LocalAttachment[]) => {
    setAttachments((current) => [...current, ...items.filter((item) => !current.some((existing) => existing.id === item.id))]);
    setComposerError(null);
  };
  const chooseAttachmentSource = () => Alert.alert("Add to prompt", "Choose an input source", [
    { text: "Camera", onPress: () => captureFromCamera().then(addAttachments).catch((e) => setComposerError(e.message)) },
    { text: "Gallery / Photos", onPress: () => pickFromGallery().then(addAttachments).catch((e) => setComposerError(e.message)) },
    { text: "Files / Documents", onPress: () => pickFiles().then(addAttachments).catch((e) => setComposerError(e.message)) },
    { text: "Cancel", style: "cancel" },
  ]);

  const startOrStopVoice = async () => {
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error("Recording produced no audio file.");
        const base64 = await readBase64(uri);
        const result = await transcribe.mutateAsync({ audioBase64: base64, mimeType: "audio/m4a", language: "ur" });
        if (!result.text.trim()) throw new Error("No speech was recognized. Please try again.");
        setIdea((value) => `${value}${value.trim() ? "\n" : ""}${result.text}`);
      } catch (error) { setComposerError(error instanceof Error ? error.message : "Voice transcription failed."); }
      return;
    }
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission was denied.");
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setComposerError(null);
    } catch (error) { setComposerError(error instanceof Error ? error.message : "Microphone is unavailable."); }
  };

  const submit = async () => {
    if (busy) return;
    const originalIdea = idea;
    if (originalIdea.trim().length < 8) { Alert.alert("Add an idea", "Describe what you want MINHAS AI to build."); return; }
    try {
      if (!idempotencyKey.current || idempotencyPrompt.current !== originalIdea) {
        idempotencyKey.current = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
        idempotencyPrompt.current = originalIdea;
      }
      setComposerError(null);
      setIsUploading(attachments.length > 0);
      const uploaded: UploadedAttachment[] = [];
      for (const item of attachments) {
        const base64 = await readBase64(item.uri);
        const result = await upload.mutateAsync({ fileName: item.name, mimeType: item.mimeType, base64 });
        uploaded.push({ name: item.name, mimeType: item.mimeType, url: result.url, textContent: item.textContent });
        setAttachments((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "uploaded", remoteUrl: result.url } : candidate));
      }
      setIsUploading(false);
      createPlan.mutate({ idea: originalIdea, type: "mobile_app", idempotencyKey: idempotencyKey.current, attachments: uploaded });
    } catch (error) {
      setIsUploading(false);
      setComposerError(error instanceof Error ? error.message : "Attachment upload failed. Your prompt is preserved; retry when ready.");
      setAttachments((current) => current.map((item) => item.status === "ready" ? { ...item, status: "failed", error: "Upload failed" } : item));
    }
  };

  const clearComposer = () => { setIdea(""); setAttachments([]); setComposerError(null); idempotencyKey.current = null; idempotencyPrompt.current = ""; createPlan.reset(); };
  const attachmentSummary = useMemo(() => attachments.map((item) => `${item.name} (${item.mimeType}, ${Math.ceil(item.size / 1024)} KB)`).join("\n"), [attachments]);

  return <ScreenContainer className="px-5 pt-5" containerClassName="bg-[#F1F2F4]"><FlatList
    data={projectsQuery.data?.slice(0, 5) ?? []}
    keyExtractor={(item) => String(item.id)}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<View>
      <View className="flex-row items-center justify-between"><View><Text className="text-sm font-semibold tracking-[2px] text-primary">MINHAS AI</Text><Text className="mt-1 text-2xl font-bold text-foreground">What should we build?</Text></View><View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/15"><IconSymbol name="sparkles" size={22} color={colors.primary} /></View></View>
      <Text className="mt-3 max-w-[330px] text-base leading-6 text-muted">Describe the product, change, or workflow. MINHAS will turn your intent into a reviewable workspace.</Text>
      <View className="mt-7 rounded-[28px] bg-white p-4" style={styles.composerShadow}><View className="min-h-[112px]"><TextInput value={idea} onChangeText={setIdea} multiline placeholder="Tell MINHAS what to build…" placeholderTextColor="#B9BBC0" style={styles.input} textAlignVertical="top" /></View><View className="mt-3 flex-row items-center justify-between"><View className="flex-row items-center gap-4"><Pressable accessibilityLabel="Add attachment" onPress={chooseAttachmentSource} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><Text className="text-3xl font-light text-[#202124]">+</Text></Pressable><Pressable accessibilityLabel="Clear prompt" onPress={clearComposer} disabled={!idea && !attachments.length} style={({ pressed }) => [styles.iconAction, (!idea && !attachments.length) && styles.disabled, pressed && styles.pressed]}><Text className="text-xl text-[#70757A]">×</Text></Pressable></View><View className="flex-row items-center gap-4"><Pressable accessibilityLabel={recorderState.isRecording ? "Stop voice recording" : "Start voice recording"} onPress={startOrStopVoice} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={23} color={recorderState.isRecording ? "#DC2626" : "#202124"} /></Pressable><Pressable accessibilityLabel="Build with MINHAS" disabled={busy} onPress={submit} style={({ pressed }) => [styles.sendButton, busy && styles.disabled, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#687076" /> : <><IconSymbol name="arrow.up" size={20} color="#FFFFFF" /></>}</Pressable></View></View></View>
      {attachments.length ? <View className="mt-3 rounded-2xl bg-white p-3"><Text className="text-xs font-semibold text-muted">ATTACHMENTS</Text>{attachments.map((item) => <View key={item.id} className="mt-2 flex-row items-center"><Text className="flex-1 text-xs text-foreground" numberOfLines={1}>{item.name} · {item.status}</Text><Pressable accessibilityLabel={`Remove ${item.name}`} onPress={() => setAttachments((current) => current.filter((candidate) => candidate.id !== item.id))}><Text className="px-2 text-error">×</Text></Pressable></View>)}<Text className="mt-2 text-[10px] text-muted">{attachmentSummary}</Text></View> : null}
      {recorderState.isRecording ? <Text className="mt-3 text-sm text-error">Listening… tap the microphone to stop and transcribe.</Text> : null}
      {composerError ? <View className="mt-3 rounded-xl bg-red-50 p-3"><Text className="text-sm text-error">{composerError}</Text><Pressable onPress={submit} disabled={busy}><Text className="mt-2 font-semibold text-primary">Retry</Text></Pressable></View> : null}
      {createPlan.error ? <Text className="mt-3 text-sm text-error">Project creation failed. Your prompt is preserved. Retry when ready.</Text> : null}
      <View className="mt-9 flex-row items-center justify-between"><View><Text className="text-xl font-bold text-foreground">Recent projects</Text><Text className="mt-1 text-sm text-muted">Continue where you left off.</Text></View><Pressable accessibilityLabel="View all projects" onPress={() => router.push("/(tabs)/projects")}><Text className="font-semibold text-primary">View all</Text></Pressable></View>
    </View>}
    renderItem={({ item }) => <Pressable accessibilityLabel={`Open ${item.name}`} onPress={() => router.push({ pathname: "/project/[id]", params: { id: String(item.id) } })} style={({ pressed }) => [styles.projectCard, pressed && styles.pressed]}><View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15"><IconSymbol name="folder.fill" size={20} color={colors.primary} /></View><View className="ml-3 flex-1"><Text className="font-semibold text-foreground" numberOfLines={1}>{item.name}</Text><Text className="mt-1 text-xs capitalize text-muted">{item.status.replaceAll("_", " ")}</Text></View><IconSymbol name="chevron.right" size={18} color={colors.muted} /></Pressable>}
    ListEmptyComponent={isAuthenticated ? <Text className="mt-5 text-sm text-muted">No projects yet. Your next build will appear here.</Text> : null}
  /></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  composerShadow: { shadowColor: "#6B7280", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  input: { minHeight: 100, color: "#202124", fontSize: 19, lineHeight: 27, padding: 0 },
  iconAction: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#202124", alignItems: "center", justifyContent: "center" },
  projectCard: { marginTop: 10, minHeight: 70, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.76)", borderWidth: 1, borderColor: "#E4E7EC", paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.78 },
});
