import Colors from "@/constants/colors";
import { useSavedItems } from "@/providers/saved-items";
import { useTrips } from "@/providers/trips";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Bookmark, Calendar, MapPin } from "lucide-react-native";
import { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips } = useTrips();
  const { items } = useSavedItems();
  const insets = useSafeAreaInsets();

  const trip = useMemo(() => {
    return trips.find((t) => t.id === id);
  }, [trips, id]);

  const tripItems = useMemo(() => {
    return items.filter((item) => item.tripId === id);
  }, [items, id]);

  if (!trip) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Trip not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={Colors.light.text} />
        </Pressable>

        <View style={styles.headerInfo}>
          <Text style={styles.tripName}>{trip.name}</Text>
          {trip.description && (
            <Text style={styles.tripDescription}>{trip.description}</Text>
          )}
          {trip.startDate && (
            <View style={styles.dateRow}>
              <Calendar size={14} color={Colors.light.mutedText} />
              <Text style={styles.dateText}>
                {new Date(trip.startDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {trip.endDate &&
                  ` - ${new Date(trip.endDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={Platform.OS === "web"}
      >
        {tripItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Bookmark size={24} color="rgba(11, 18, 32, 0.25)" />
            </View>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptyText}>
              Screenshots assigned to this trip will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {tripItems.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.itemCard,
                  pressed && styles.itemCardPressed,
                ]}
                onPress={() =>
                  router.push({ pathname: "/modal", params: { id: item.id } })
                }
              >
                <View style={styles.itemThumb}>
                  {item.imageUri ? (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.itemImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.itemPlaceholder}>
                      <Bookmark size={14} color="rgba(11, 18, 32, 0.15)" />
                    </View>
                  )}
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <View style={styles.itemMeta}>
                    {item.location && (
                      <View style={styles.metaRow}>
                        <MapPin size={12} color={Colors.light.mutedText} />
                        <Text numberOfLines={1} style={styles.metaText}>
                          {item.location}
                        </Text>
                      </View>
                    )}
                    {item.dateTimeISO && (
                      <Text style={styles.itemDate}>
                        {new Date(item.dateTimeISO).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" }
                        )}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11, 18, 32, 0.05)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  backButtonPressed: {
    backgroundColor: "rgba(11, 18, 32, 0.1)",
  },
  headerInfo: {
    gap: 6,
  },
  tripName: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.6,
  },
  tripDescription: {
    fontSize: 15,
    color: Colors.light.mutedText,
    lineHeight: 22,
  },
  dateRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 13,
    color: Colors.light.mutedText,
  },
  content: {
    paddingTop: 20,
  },
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(11, 18, 32, 0.04)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.mutedText,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  itemsList: {
    gap: 2,
  },
  itemCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 12,
  },
  itemCardPressed: {
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F0F0EE",
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemPlaceholder: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  itemMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 13,
    color: Colors.light.mutedText,
    flex: 1,
  },
  itemDate: {
    fontSize: 12,
    color: "rgba(11, 18, 32, 0.4)",
  },
  notFound: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.light.mutedText,
  },
});
