import Colors from "@/constants/colors";
import { useSavedItems } from "@/providers/saved-items";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import {
  Calendar,
  Share2,
  FileText,
  Bell,
  Lightbulb,
  MapPin,
  Navigation,
  ExternalLink,
  X,
} from "lucide-react-native";
import { useMemo, useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Web-only map preview using Google Maps JS API
let WebGoogleMap: any, WebLoadScript: any, WebMarker: any;
try {
  // eslint-disable-next-line global-require
  const lib = require("@react-google-maps/api");
  WebGoogleMap = lib.GoogleMap;
  WebLoadScript = lib.LoadScript;
  WebMarker = lib.Marker;
} catch (e) {
  console.warn("[modal.web] Failed to load @react-google-maps/api", e);
}

function WebMapPreview({ coordinates }: { coordinates: { latitude: number; longitude: number } }) {
  if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) return null;
  if (!WebGoogleMap || !WebLoadScript) return null;

  return (
    <View style={styles.mapPreview}>
      <WebLoadScript googleMapsApiKey={process.env.EXPO_PUBLIC_GEMINI_API_KEY}>
        <WebGoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={{ lat: coordinates.latitude, lng: coordinates.longitude }}
          zoom={15}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            keyboardShortcuts: false,
          }}
        >
          <WebMarker position={{ lat: coordinates.latitude, lng: coordinates.longitude }} />
        </WebGoogleMap>
      </WebLoadScript>
    </View>
  );
}

function formatWhen(dateIso?: string | null): string {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return d.toLocaleDateString(undefined, options);
}

type ActionType = "calendar" | "share" | "plan" | "note" | "reminder";

function getPrimaryAction(category: string): { type: ActionType; label: string; icon: typeof Calendar } {
  const cat = category.toLowerCase();

  if (cat === "events" || cat.includes("event")) {
    return { type: "calendar", label: "Add to calendar", icon: Calendar };
  }
  if (cat === "travel") {
    return { type: "plan", label: "Add to plan", icon: FileText };
  }
  if (["date night", "hikes", "food", "restaurant", "bar", "cafe"].some((p) => cat.includes(p))) {
    return { type: "share", label: "Share", icon: Share2 };
  }
  if (cat === "shopping" || cat.includes("product") || cat.includes("service")) {
    return { type: "note", label: "Add note", icon: FileText };
  }
  if (cat.includes("document") || cat.includes("admin")) {
    return { type: "reminder", label: "Add reminder", icon: Bell };
  }
  if (cat.includes("idea") || cat.includes("inspiration")) {
    return { type: "note", label: "Add note", icon: Lightbulb };
  }

  return { type: "note", label: "Add note", icon: FileText };
}

export default function ModalScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const { items, removeItem } = useSavedItems();
  const [screenshotExpanded, setScreenshotExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const item = useMemo(() => items.find((x) => x.id === id), [id, items]);

  const primaryAction = useMemo(() => {
    if (!item) return null;
    return getPrimaryAction(item.category);
  }, [item]);

  const handlePrimaryAction = useCallback(async () => {
    if (!item || !primaryAction) return;

    switch (primaryAction.type) {
      case "calendar":
        Alert.alert("Add to Calendar", "This would open your calendar to create an event.");
        break;
      case "share":
        try {
          await Share.share({
            message: `${item.title}${item.location ? `\n📍 ${item.location}` : ""}${item.notes ? `\n\n${item.notes}` : ""}`,
          });
        } catch (e) {
          console.log("[Modal.web] share error", e);
        }
        break;
      case "plan":
        Alert.alert("Add to Plan", "This would add the item to your travel plan.");
        break;
      case "note":
        Alert.alert("Add Note", "This would let you add a personal note.");
        break;
      case "reminder":
        Alert.alert("Add Reminder", "This would set a reminder for this item.");
        break;
    }
  }, [item, primaryAction]);

  const handleRemove = useCallback(() => {
    if (!item) return;
    Alert.alert("Remove this plan?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeItem(item.id);
          router.back();
        },
      },
    ]);
  }, [item, removeItem]);

  const ActionIcon = primaryAction?.icon ?? FileText;

  return (
    <View style={styles.root} testID="itemModalRoot">
      <Stack.Screen
        options={{
          title: "",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.background },
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              style={styles.headerBtn}
              testID="itemModalClose"
            >
              <X size={18} color={Colors.light.text} />
            </Pressable>
          ),
        }}
      />

      {!item ? (
        <View style={styles.missing}>
          <Text style={styles.title}>Item not found</Text>
          <Text style={styles.body}>It may have been removed.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator
          testID="itemModalScroll"
        >
          <View style={styles.details}>
            <Text style={styles.title} testID="itemModalTitle">
              {item.title}
            </Text>

            <View style={styles.meta}>
              {item.dateTimeISO ? (
                <Text style={styles.when} testID="itemModalWhen">
                  {formatWhen(item.dateTimeISO)}
                </Text>
              ) : null}
              <Text style={styles.category}>{item.category}</Text>
            </View>

            {item.notes ? (
              <Text style={styles.summary} testID="itemModalNotes">
                {item.notes}
              </Text>
            ) : null}

            {item.location ? (
              <View style={styles.locationRow}>
                <MapPin size={14} color={Colors.light.mutedText} />
                <Text style={styles.locationText}>{item.location}</Text>
              </View>
            ) : null}
          </View>

          {item.coordinates ? <WebMapPreview coordinates={item.coordinates} /> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={handlePrimaryAction}
              style={styles.primaryAction}
              testID="itemModalPrimaryAction"
            >
              <ActionIcon size={18} color={Colors.light.text} />
              <Text style={styles.primaryActionText}>{primaryAction?.label}</Text>
            </Pressable>

            <View style={styles.secondaryActions}>
              {item.coordinates ? (
                <Pressable
                  onPress={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${item.coordinates!.latitude},${item.coordinates!.longitude}`;
                    Linking.openURL(url);
                  }}
                  style={styles.secondaryAction}
                  testID="itemModalDirections"
                >
                  <Navigation size={16} color={Colors.light.mutedText} />
                  <Text style={styles.secondaryActionText}>Directions</Text>
                </Pressable>
              ) : null}

              {item.reservationUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(item.reservationUrl!)}
                  style={styles.secondaryAction}
                >
                  <ExternalLink size={16} color={Colors.light.mutedText} />
                  <Text style={styles.secondaryActionText}>Book</Text>
                </Pressable>
              ) : null}

              {item.websiteUri ? (
                <Pressable
                  onPress={() => Linking.openURL(item.websiteUri!)}
                  style={styles.secondaryAction}
                >
                  <ExternalLink size={16} color={Colors.light.mutedText} />
                  <Text style={styles.secondaryActionText}>Website</Text>
                </Pressable>
              ) : null}

              {item.instagram ? (
                <Pressable
                  onPress={() => Linking.openURL(`https://instagram.com/${item.instagram!.replace(/^@/, '')}`)}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>Instagram</Text>
                </Pressable>
              ) : null}

              {item.tiktok ? (
                <Pressable
                  onPress={() => Linking.openURL(`https://tiktok.com/@${item.tiktok!.replace(/^@/, '')}`)}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>TikTok</Text>
                </Pressable>
              ) : null}

              {item.source ? (
                <Pressable
                  onPress={() => {
                    if (item.source?.startsWith("http")) {
                      Linking.openURL(item.source);
                    }
                  }}
                  style={styles.secondaryAction}
                  disabled={!item.source?.startsWith("http")}
                >
                  <ExternalLink size={16} color={Colors.light.mutedText} />
                  <Text style={styles.secondaryActionText}>
                    {item.source?.startsWith("http") ? "View source" : item.source}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {item.imageUri && !imageError ? (
            <View style={styles.sourceSection}>
              <Text style={styles.sourceSectionLabel}>Source</Text>
              <Pressable
                onPress={() => setScreenshotExpanded(true)}
                style={styles.screenshotContainer}
                testID="itemModalScreenshot"
              >
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.screenshotThumbnail}
                  contentFit="cover"
                  onError={() => setImageError(true)}
                />
                <View style={styles.thumbnailOverlay}>
                  <Text style={styles.thumbnailHint}>View</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {item.imageUri && !imageError ? (
            <Modal
              visible={screenshotExpanded}
              transparent
              animationType="fade"
              onRequestClose={() => setScreenshotExpanded(false)}
            >
              <Pressable
                style={styles.screenshotOverlay}
                onPress={() => setScreenshotExpanded(false)}
              >
                <View style={styles.screenshotFullContainer}>
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.screenshotFull}
                    contentFit="contain"
                  />
                </View>
                <Pressable
                  onPress={() => setScreenshotExpanded(false)}
                  style={styles.screenshotCloseBtn}
                >
                  <X size={20} color="#fff" />
                </Pressable>
              </Pressable>
            </Modal>
          ) : null}

          <Pressable
            onPress={handleRemove}
            style={styles.removeAction}
            testID="itemModalRemove"
          >
            <Text style={styles.removeActionText}>Remove from plans</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 18, 32, 0.05)",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  missing: {
    padding: 20,
    gap: 8,
  },
  sourceSection: {
    marginBottom: 24,
  },
  sourceSectionLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.mutedText,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  screenshotContainer: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(11, 18, 32, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(11, 18, 32, 0.06)",
  },
  screenshotThumbnail: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
  thumbnailOverlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: "rgba(11, 18, 32, 0.5)",
  },
  thumbnailHint: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500" as const,
  },
  screenshotOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  screenshotFullContainer: {
    width: "90%",
    height: "80%",
  },
  screenshotFull: {
    width: "100%",
    height: "100%",
  },
  screenshotCloseBtn: {
    position: "absolute" as const,
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  details: {
    gap: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  when: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.mutedText,
  },
  category: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.mutedText,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(11, 18, 32, 0.04)",
    borderRadius: 6,
    overflow: "hidden",
  },
  summary: {
    fontSize: 15,
    color: "rgba(11, 18, 32, 0.72)",
    lineHeight: 22,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.light.mutedText,
  },
  body: {
    fontSize: 14,
    color: Colors.light.mutedText,
    lineHeight: 20,
  },
  mapPreview: {
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "rgba(11, 18, 32, 0.03)",
  },
  actions: {
    gap: 16,
    marginBottom: 32,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.text,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(11, 18, 32, 0.04)",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.mutedText,
  },
  removeAction: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  removeActionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(11, 18, 32, 0.4)",
  },
});

