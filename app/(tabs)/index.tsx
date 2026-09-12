
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

const features = [
  { id: "mobile", title: "Develop mobile apps", description: "Design, build, test, and ship Expo + React Native apps", icon: "iphone" as const, available: true },
];

const examples = [
  "ایک مکمل کریانہ POS بناؤ جس میں Sales، Inventory اور Khata ہوں۔",
  "Build a school management system with attendance and fee tracking.",
  "Roman Urdu mein chhota CRM banao jo leads aur follow-ups manage kare.",
];

export default function HomeScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [idea, setIdea] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const createPlan = trpc.projects.createPlan.useMutation({
    onSuccess: ({ projectId }) => router.push({ pathname: "/project/[id]", params: { id: String(projectId) } }),
  });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const templatesQuery = trpc.templates.list.useQuery();

  const chooseFeature = () => setIdea("Build a mobile app: ");

  const submit = async () => {
    if (!isAuthenticated) {
      try {
        setLoginError(null);
        await startOAuthLogin();
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : "Unable to start login.");
      }
      return;
    }
    if (idea.trim().length < 8) {
      Alert.alert("Add an idea", "Describe what you want MINHAS AI to build.");
      return;
    }
    createPlan.mutate({ idea: idea.trim(), type: "mobile_app" });
  };

  return (
    <ScreenContainer className="px-5 pt-5" containerClassName="bg-[#F1F2F4]">
      <FlatList
        data={projectsQuery.data?.slice(0, 3) ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-semibold tracking-[2px] text-primary">MINHAS AI</Text>
                <Text className="mt-1 text-2xl font-bold text-foreground">App Builder</Text>
              </View>
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                <IconSymbol name="sparkles" size={22} color={colors.primary} />
              </View>
            </View>

            <View className="mt-8">
              <View className="flex-row items-center justify-between px-3">
                <Text className="text-[30px] font-bold text-[#202124]">Get started</Text>
                <Pressable accessibilityLabel="Close get started" onPress={() => setIdea("")} style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.55 }]}>
                  <Text className="text-3xl font-light text-[#70757A]">×</Text>
                </Pressable>
              </View>
              <FlatList
                data={features}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.featureList}
                renderItem={({ item }) => (
                  <Pressable onPress={chooseFeature} style={({ pressed }) => [styles.featureCard, pressed && styles.pressed]}>
                    <View style={styles.featureIconWrap}>
                      <IconSymbol name={item.icon} size={31} color="#4A4D52" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[21px] font-bold leading-7 text-[#202124]" numberOfLines={2}>{item.title}</Text>
                      <Text className="mt-1 text-base leading-6 text-[#74777D]" numberOfLines={2}>{item.description}</Text>
                      
                    </View>
                  </Pressable>
                )}
              />
            </View>

            <View className="mt-5 rounded-[28px] bg-white p-4" style={styles.composerShadow}>
              <TextInput
                value={idea}
                onChangeText={setIdea}
                multiline
                placeholder="Assign a task or type / for more"
                placeholderTextColor="#B9BBC0"
                style={styles.input}
                textAlignVertical="top"
              />
              <View className="mt-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-5">
                  <IconSymbol name="plus" size={27} color="#202124" />
                  <IconSymbol name="sparkles" size={26} color="#202124" />
                </View>
                <View className="flex-row items-center gap-5">
                  <IconSymbol name="sparkles" size={25} color="#202124" />
                  <IconSymbol name="mic.fill" size={25} color="#202124" />
                  <Pressable onPress={submit} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
                    {createPlan.isPending || authLoading ? <ActivityIndicator color="#B8BCC2" /> : <Text className="text-2xl text-[#B8BCC2]">↑</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
            {createPlan.error ? <Text className="mt-3 text-sm text-error">{createPlan.error.message}</Text> : null}
            {loginError ? <Text className="mt-3 text-sm text-error">{loginError}</Text> : null}

            <Text className="mt-7 text-xs font-semibold tracking-[1.5px] text-muted">START FROM A TEMPLATE</Text>
            <FlatList
              data={templatesQuery.data?.slice(0, 4) ?? []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.templateList}
              renderItem={({ item }) => (
                <Pressable onPress={() => setIdea(item.prompt)} style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.75 }]}>
                  <Text className="text-base font-bold text-foreground">{item.name}</Text>
                  <Text className="mt-1 text-xs leading-4 text-muted" numberOfLines={3}>{item.description}</Text>
                  <Text className="mt-2 text-[10px] font-bold text-primary">{item.capabilities.join(" · ")}</Text>
                </Pressable>
              )}
            />

            <Text className="mt-7 text-xs font-semibold tracking-[1.5px] text-muted">TRY AN IDEA</Text>
            <View className="mt-3 gap-2">
              {examples.map((item) => (
                <Pressable key={item} onPress={() => setIdea(item)} style={({ pressed }) => [styles.example, pressed && { opacity: 0.72 }]}>
                  <Text className="flex-1 text-sm leading-5 text-foreground">{item}</Text>
                  <IconSymbol name="chevron.right" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>

            <View className="mt-8 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">Recent projects</Text>
              <Pressable onPress={() => router.push("/(tabs)/projects")}><Text className="font-semibold text-primary">View all</Text></Pressable>
            </View>
            {!isAuthenticated ? <Text className="mt-3 text-sm leading-5 text-muted">Sign in to persist your work across devices.</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: "/project/[id]", params: { id: String(item.id) } })} style={({ pressed }) => [styles.projectCard, pressed && { opacity: 0.78 }]}>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15"><IconSymbol name="folder.fill" size={20} color={colors.primary} /></View>
            <View className="ml-3 flex-1"><Text className="font-semibold text-foreground" numberOfLines={1}>{item.name}</Text><Text className="mt-1 text-xs text-muted">{item.status.replaceAll("_", " ")}</Text></View>
            <IconSymbol name="chevron.right" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={isAuthenticated ? <Text className="mt-4 text-sm text-muted">No projects yet. Start with an idea above.</Text> : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  featureList: { paddingTop: 14, paddingRight: 18, gap: 12 },
  templateList: { paddingTop: 10, paddingRight: 18, gap: 10 },
  templateCard: { width: 220, minHeight: 122, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E7EC", padding: 14 },
  featureCard: { width: 310, minHeight: 162, borderRadius: 26, backgroundColor: "#E4E5E7", paddingHorizontal: 22, paddingVertical: 22, flexDirection: "row", alignItems: "center", gap: 18 },
  featureIconWrap: { width: 72, height: 92, borderRadius: 18, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  composerShadow: { shadowColor: "#6B7280", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  input: { minHeight: 76, color: "#202124", fontSize: 19, lineHeight: 27, padding: 0 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F1F2F4", alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  example: { minHeight: 58, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "#E4E7EC", paddingHorizontal: 15, paddingVertical: 11, flexDirection: "row", alignItems: "center" },
  projectCard: { marginTop: 10, minHeight: 70, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.76)", borderWidth: 1, borderColor: "#E4E7EC", paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
});


