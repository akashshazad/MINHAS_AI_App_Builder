
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { isManusOAuthConfigured, startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

export default function SettingsScreen() {
  const colors = useColors();
  const { user, isAuthenticated, logout } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const status = trpc.projects.capabilityStatus.useQuery();
  const health = trpc.projects.platformHealth.useQuery();
  return (
    <ScreenContainer className="px-5 pt-5">
      <View className="flex-1">
        <Text className="text-3xl font-bold text-foreground">Settings</Text>
        <Text className="mt-2 text-base leading-6 text-muted">Account, platform status, and honest delivery boundaries.</Text>
        <View className="mt-7 rounded-3xl bg-surface p-5 shadow-sm">
          <View className="flex-row items-center"><View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/15"><IconSymbol name="person.circle.fill" size={25} color={colors.primary} /></View><View className="ml-3 flex-1"><Text className="font-semibold text-foreground">{user?.loginMethod === "anonymous" ? "MINHAS guest workspace" : user?.name ?? "MINHAS workspace"}</Text><Text className="mt-1 text-xs text-muted">Core workspace authentication is active</Text></View></View>
          <Pressable disabled={!isManusOAuthConfigured} onPress={async () => { if (isAuthenticated && user?.loginMethod !== "anonymous") { await logout(); return; } try { setLoginError(null); await startOAuthLogin(); } catch (error) { setLoginError(error instanceof Error ? error.message : "Unable to connect Manus account."); } }} style={({ pressed }) => [styles.outline, !isManusOAuthConfigured && styles.disabled, pressed && { opacity: 0.7 }]}><Text className="font-semibold text-foreground">{isManusOAuthConfigured ? (user?.loginMethod === "anonymous" ? "Connect Manus account (optional)" : "Disconnect Manus account") : "Manus account connection unavailable"}</Text></Pressable>
          {!isManusOAuthConfigured ? <Text className="mt-3 text-xs leading-5 text-muted">Optional integration is not configured. Core MINHAS AI generation does not depend on it.</Text> : null}
          {loginError ? <Text className="mt-3 text-sm leading-5 text-error">{loginError}</Text> : null}
        </View>
        <Text className="mt-8 text-xs font-semibold tracking-[1.5px] text-muted">PLATFORM STATUS</Text>
        <View className="mt-3 rounded-3xl bg-surface p-5 shadow-sm">
          <StatusRow label="AI planning + file generation" value={health.data?.ai.status === "ONLINE" ? "ONLINE" : "BLOCKED"} good={health.data?.ai.status === "ONLINE"} />
          <StatusRow label="Cloud project persistence" value={health.data?.database.status === "ONLINE" ? "ONLINE" : "BLOCKED"} good={health.data?.database.status === "ONLINE"} />
          <StatusRow label="Remote build / live preview" value={status.data?.remoteBuild ?? "Loading…"} />
          <StatusRow label="Preview runtime" value={status.data?.previewRuntime ?? "Loading…"} />
          <StatusRow label="APK/AAB artifact management" value={status.data?.artifactManagement ?? "Loading…"} />
          <StatusRow label="AI coding agent" value={status.data?.codingAgent ?? "Loading…"} />
          <StatusRow label="AI review / bounded auto-fix" value={status.data?.autoFix ?? "Loading…"} />
          <StatusRow label="Snapshots / restore points" value={status.data?.snapshots ?? "Loading…"} />
          <StatusRow label="Autonomous software factory" value={status.data?.autonomousPipeline ?? "Loading…"} />
          <StatusRow label="Project graph / impact map" value={status.data?.projectGraph ?? "Loading…"} />
          <StatusRow label="Secure ZIP export" value={status.data?.exportZip ?? "Loading…"} />
          <StatusRow label="Deployment providers" value={status.data?.deploy ?? "Loading…"} />
          <StatusRow label="Templates / documentation" value={status.data?.templates ?? "Loading…"} last />
        </View>
        <View className="mt-6 flex-row items-center justify-between"><Text className="text-xs font-semibold tracking-[1.5px] text-muted">SERVICE HEALTH</Text><Pressable onPress={() => health.refetch()} disabled={health.isFetching}><Text className="text-xs font-bold text-primary">{health.isFetching ? "Refreshing…" : "Refresh"}</Text></Pressable></View>
        <View className="mt-3 rounded-3xl bg-surface p-5 shadow-sm">
          <StatusRow label="Database" value={health.data?.database.status ?? "Loading…"} good={health.data?.database.status === "ONLINE"} />
          <StatusRow label="Authentication" value={health.data?.auth.status ?? "Loading…"} good={health.data?.auth.status === "ONLINE"} />
          <StatusRow label="Isolated build" value={health.data?.build.status ?? "Loading…"} good={health.data?.build.status === "ONLINE"} />
          <StatusRow label="Preview runtime" value={health.data?.preview.status ?? "Loading…"} good={health.data?.preview.status === "ONLINE"} />
          <StatusRow label="Deployment service" value={health.data?.deployment.status ?? "Loading…"} good={health.data?.deployment.status === "ONLINE"} />
          <StatusRow label="Artifact storage" value={health.data?.artifact.status ?? "Loading…"} good={health.data?.artifact.status === "ONLINE"} last />
        </View>
        <Text className="mt-5 text-xs leading-5 text-muted">Only verified capabilities are shown as LIVE. Unavailable infrastructure is shown as BLOCKED until it is actually operational.</Text>
      </View>
    </ScreenContainer>
  );
}

function StatusRow({ label, value, good, last }: { label: string; value: string; good?: boolean; last?: boolean }) {
  return <View className={`flex-row items-center justify-between py-3 ${last ? "" : "border-b border-border"}`}><Text className="flex-1 pr-3 text-sm text-foreground">{label}</Text><Text className={`text-right text-[10px] font-bold ${good ? "text-success" : "text-warning"}`}>{value}</Text></View>;
}

const styles = StyleSheet.create({ outline: { marginTop: 18, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "#D0D5DD", alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.55 } });
