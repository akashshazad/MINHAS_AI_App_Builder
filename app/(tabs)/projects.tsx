
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function ProjectsScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const projects = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  return (
    <ScreenContainer className="px-5 pt-5">
      <FlatList
        data={projects.data ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View><Text className="text-3xl font-bold text-foreground">Projects</Text><Text className="mt-2 text-base leading-6 text-muted">Your persisted software workspaces, plans, and generated files.</Text>{!isAuthenticated ? <Text className="mt-5 rounded-2xl bg-warning/15 p-4 text-sm leading-5 text-foreground">Sign in from Home to create and sync projects.</Text> : null}</View>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: "/project/[id]", params: { id: String(item.id) } })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/15"><IconSymbol name="folder.fill" size={21} color={colors.primary} /></View>
            <View className="ml-3 flex-1"><Text className="font-semibold text-foreground" numberOfLines={1}>{item.name}</Text><Text className="mt-1 text-xs capitalize text-muted">{item.status.replaceAll("_", " ")} · {item.framework}</Text></View>
            <View className="rounded-full bg-primary/10 px-2.5 py-1"><Text className="text-[11px] font-semibold text-primary">{item.buildStatus.replaceAll("_", " ")}</Text></View>
          </Pressable>
        )}
        ListEmptyComponent={isAuthenticated && !projects.isLoading ? <Text className="mt-6 text-sm text-muted">No projects yet. Start on Home.</Text> : null}
        ListFooterComponent={projects.isLoading ? <Text className="mt-6 text-sm text-muted">Loading your projects…</Text> : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  card: { marginTop: 12, minHeight: 78, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#E4E7EC", backgroundColor: "rgba(255,255,255,0.78)", flexDirection: "row", alignItems: "center" },
});


