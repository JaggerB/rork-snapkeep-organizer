import Colors from "@/constants/colors";
import { useSavedItems } from "@/providers/saved-items";
import { planItinerary, ItineraryPlan } from "@/lib/ai/maps-grounding";
import { router, Stack } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { items } = useSavedItems();
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsWithLocation = items.filter((i) => i.coordinates || i.location);

  const handlePlan = useCallback(async () => {
    if (itemsWithLocation.length === 0) {
      setError("Add places with locations first to plan an itinerary.");
      return;
    }
    setIsPlanning(true);
    setError(null);
    setPlan(null);
    try {
      const result = await planItinerary(itemsWithLocation, query || undefined);
      if (result) {
        setPlan(result);
        setError(null);
      } else {
        // Backend unavailable or failed: use simple fallback order
        setPlan({
          summary: "Here's a suggested order for your places. For AI-optimized routes based on distance, deploy the gemini-maps backend.",
          orderedItems: itemsWithLocation.map((i, idx) => ({ itemId: i.id, order: idx + 1 })),
        });
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to plan itinerary");
    } finally {
      setIsPlanning(false);
    }
  }, [itemsWithLocation, query]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
          <ChevronLeft size={24} color="#6366F1" />
        </Pressable>
        <Text style={styles.headerTitle}>Plan itinerary</Text>
      </View>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>AI will suggest the best order to visit your saved places using Google Maps data.</Text>

          <Text style={styles.label}>Your places ({itemsWithLocation.length})</Text>
          {itemsWithLocation.length === 0 ? (
            <Text style={styles.emptyText}>No places with locations yet. Add screenshots of places to get started.</Text>
          ) : (
            <View style={styles.placesPreview}>
              {itemsWithLocation.slice(0, 5).map((i) => (
                <Text key={i.id} style={styles.placePreviewItem}>• {i.title}</Text>
              ))}
              {itemsWithLocation.length > 5 && (
                <Text style={styles.placePreviewMore}>+{itemsWithLocation.length - 5} more</Text>
              )}
            </View>
          )}

          <Text style={styles.label}>Optional: Add instructions</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Start with breakfast, end near the hotel, prioritize walking distance"
            placeholderTextColor={Colors.light.mutedText}
            value={query}
            onChangeText={setQuery}
            multiline
            numberOfLines={3}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          {isPlanning && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.loadingText}>Planning with Google Maps...</Text>
            </View>
          )}

          {plan && (
            <View style={styles.planSection}>
              <Text style={styles.planSectionTitle}>Your itinerary</Text>
              {plan.summary && <Text style={styles.planSummary}>{plan.summary}</Text>}
              {plan.orderedItems.map(({ itemId, order, suggestion }) => {
                const item = items.find((i) => i.id === itemId);
                return (
                  <Pressable
                    key={itemId}
                    onPress={() => router.replace({ pathname: "/modal", params: { id: itemId } })}
                    style={styles.planItem}
                  >
                    <View style={styles.planItemNumber}>
                      <Text style={styles.planItemNumberText}>{order}</Text>
                    </View>
                    <View style={styles.planItemContent}>
                      <Text style={styles.planItemTitle}>{item?.title ?? "Unknown"}</Text>
                      {suggestion && <Text style={styles.planItemSuggestion}>{suggestion}</Text>}
                    </View>
                  </Pressable>
                );
              })}
              {plan.walkingNotes && (
                <View style={styles.walkingNotes}>
                  <Text style={styles.walkingNotesLabel}>Walking tips</Text>
                  <Text style={styles.walkingNotesText}>{plan.walkingNotes}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handlePlan}
            disabled={isPlanning || itemsWithLocation.length === 0}
            style={({ pressed }) => [
              styles.planBtn,
              (isPlanning || itemsWithLocation.length === 0) && styles.planBtnDisabled,
              pressed && styles.planBtnPressed,
            ]}
          >
            <Text style={styles.planBtnText}>{isPlanning ? "Planning..." : "Plan itinerary"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99, 102, 241, 0.1)" },
  headerBtnPressed: { opacity: 0.7 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: Colors.light.text, marginLeft: 12 },
  content: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  subtitle: { fontSize: 14, color: Colors.light.mutedText, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.light.mutedText, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.light.mutedText, marginBottom: 20 },
  placesPreview: { marginBottom: 24, padding: 14, backgroundColor: "#F9FAFB", borderRadius: 12 },
  placePreviewItem: { fontSize: 14, color: Colors.light.text, marginBottom: 4 },
  placePreviewMore: { fontSize: 13, color: Colors.light.mutedText, marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 15, color: Colors.light.text, minHeight: 80, textAlignVertical: "top", marginBottom: 20 },
  errorText: { fontSize: 14, color: "#EF4444", marginBottom: 16 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  loadingText: { fontSize: 14, color: Colors.light.mutedText },
  planSection: { marginTop: 8, marginBottom: 24 },
  planSectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.light.text, marginBottom: 12 },
  planSummary: { fontSize: 14, lineHeight: 20, color: Colors.light.text, marginBottom: 16 },
  planItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  planItemNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center", marginRight: 12 },
  planItemNumberText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  planItemContent: { flex: 1 },
  planItemTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.text },
  planItemSuggestion: { fontSize: 13, color: Colors.light.mutedText, marginTop: 4 },
  walkingNotes: { marginTop: 16, padding: 14, backgroundColor: "rgba(99, 102, 241, 0.08)", borderRadius: 12 },
  walkingNotesLabel: { fontSize: 13, fontWeight: "600", color: "#6366F1", marginBottom: 6 },
  walkingNotesText: { fontSize: 14, color: Colors.light.text, lineHeight: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
  planBtn: { backgroundColor: "#6366F1", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  planBtnDisabled: { opacity: 0.5 },
  planBtnPressed: { opacity: 0.9 },
  planBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
