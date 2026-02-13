import Colors from "@/constants/colors";
import { useSavedItems } from "@/providers/saved-items";
import { getPlaceLiveStatus } from "@/lib/ai/maps-grounding";
import { fetchPlaceDetailsFromPlaceId } from "@/lib/ai/lookup-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import {
  Calendar,
  MapPin,
  Navigation,
  ChevronLeft,
  Share2,
  MoreHorizontal,
  X,
  ExternalLink,
} from "lucide-react-native";
import { useMemo, useCallback, useState, useEffect } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
let NativeMapView: any = null;
let NativeMarker: any = null;
if (Platform.OS !== "web") {
  try {
    const RNMaps = require("react-native-maps");
    NativeMapView = RNMaps.default;
    NativeMarker = RNMaps.Marker;
  } catch (e) {
    console.warn("[Modal] Failed to load react-native-maps", e);
  }
}

function formatDate(dateIso?: string | null): string {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString('en-US', { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function ModalScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();
  const { items, removeItem } = useSavedItems();
  const [screenshotExpanded, setScreenshotExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{ openNow: boolean | null; rating: string | null; openingHours: string | null; reviewSnippet: string | null } | null>(null);
  const [liveStatusLoading, setLiveStatusLoading] = useState(false);
  const [fetchedWebsiteUri, setFetchedWebsiteUri] = useState<string | null>(null);

  const item = useMemo(() => items.find((x) => x.id === id), [id, items]);

  useEffect(() => {
    setFetchedWebsiteUri(null);
    if (!item?.placeId || item.websiteUri) return;
    let cancelled = false;
    fetchPlaceDetailsFromPlaceId(item.placeId).then(({ websiteUri }) => {
      if (!cancelled && websiteUri) setFetchedWebsiteUri(websiteUri);
    });
    return () => { cancelled = true; };
  }, [item?.id, item?.placeId, item?.websiteUri]);

  useEffect(() => {
    if (!item) return;
    const canFetch = item.placeId || (item.coordinates && item.title);
    if (!canFetch) return;
    let cancelled = false;
    setLiveStatusLoading(true);
    getPlaceLiveStatus(item.placeId ?? null, item.title, item.coordinates ?? null)
      .then((status) => {
        if (!cancelled) setLiveStatus(status);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLiveStatusLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const handleShare = useCallback(async () => {
    if (!item) return;
    try {
      await Share.share({
        message: `${item.title}${item.location ? `\n📍 ${item.location}` : ""}`,
      });
    } catch (e) {
      console.log("[Modal] share error", e);
    }
  }, [item]);

  const handleMoreOptions = useCallback(() => {
    Alert.alert("Coming Soon", "More options coming soon!");
  }, []);

  const handleAddToCalendar = useCallback(() => {
    if (!item) return;
    Alert.alert("Add to Calendar", "This would open your calendar to create an event.");
  }, [item]);

  const handleRemove = useCallback(() => {
    if (!item) return;
    Alert.alert("Remove this place?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { removeItem(item.id); router.back(); } },
    ]);
  }, [item, removeItem]);

  const hasValidDate = item?.dateTimeISO && !isNaN(new Date(item.dateTimeISO).getTime());
  const isEvent = item?.category?.toLowerCase() === 'event' || item?.category === 'Events';

  const screenOptions = useMemo(() => ({ headerShown: false } as const), []);

  if (!item) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.title}>Item not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={screenOptions} />
      <View style={[styles.headerArea, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
          <ChevronLeft size={24} color="#6366F1" />
        </Pressable>
        <View style={styles.headerRightIcons}>
          <Pressable onPress={handleShare} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
            <Share2 size={20} color="#6366F1" />
          </Pressable>
          <Pressable onPress={handleMoreOptions} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
            <MoreHorizontal size={20} color="#6366F1" />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.modalScrollView} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.details}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.metaText}>
            {item.category || "Saved"}
            {(item.rating || liveStatus?.rating) && ` · ${liveStatus?.rating ?? item.rating} ★`}
            {hasValidDate && ` · ${formatDate(item.dateTimeISO)}`}
          </Text>
          {(item.openNow !== undefined && item.openNow !== null) || (liveStatus?.openNow !== undefined && liveStatus?.openNow !== null) ? (
            <View style={styles.liveStatusRow}>
              <View style={[styles.openNowBadge, (liveStatus?.openNow ?? item.openNow) ? styles.openNowBadgeOpen : styles.openNowBadgeClosed]}>
                <Text style={[(liveStatus?.openNow ?? item.openNow) ? styles.openNowTextOpen : styles.openNowTextClosed]}>{(liveStatus?.openNow ?? item.openNow) ? "Open now" : "Closed"}</Text>
              </View>
              {(liveStatus?.openingHours ?? item.openingHours) && (
                <Text style={styles.openingHoursText}>{liveStatus?.openingHours ?? item.openingHours}</Text>
              )}
            </View>
          ) : liveStatusLoading ? (
            <Text style={styles.liveStatusLoading}>Checking hours...</Text>
          ) : null}
          {(liveStatus?.reviewSnippet ?? item.reviewSnippet) && (
            <Text style={styles.reviewSnippet}>"{liveStatus?.reviewSnippet ?? item.reviewSnippet}"</Text>
          )}
          {item.notes && <Text style={styles.description}>{item.notes}</Text>}
        </View>

        {item.coordinates && NativeMapView && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionLabel}>Location</Text>
            <View style={styles.mapContainer}>
              <NativeMapView
                style={styles.map}
                initialRegion={{
                  latitude: item.coordinates.latitude,
                  longitude: item.coordinates.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                showsUserLocation={false}
              >
                <NativeMarker coordinate={{ latitude: item.coordinates.latitude, longitude: item.coordinates.longitude }}>
                  <View style={styles.mapMarker}>
                    <MapPin size={20} color="#fff" fill="#6366F1" />
                  </View>
                </NativeMarker>
              </NativeMapView>
            </View>
          </View>
        )}

        {!item.coordinates && item.location && (
          <View style={styles.locationFallback}>
            <MapPin size={16} color="#6366F1" />
            <Text style={styles.locationFallbackText}>{item.location}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <View style={styles.actionRow}>
            {item.coordinates && (
              <Pressable
                onPress={() => {
                  const url = Platform.OS === 'ios'
                    ? `maps://?daddr=${item.coordinates!.latitude},${item.coordinates!.longitude}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${item.coordinates!.latitude},${item.coordinates!.longitude}`;
                  Linking.openURL(url);
                }}
                style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.actionBtnOutlinePressed]}
              >
                <Navigation size={16} color="#6366F1" />
                <Text style={styles.actionBtnOutlineText}>Directions</Text>
              </Pressable>
            )}
            {item.reservationUrl && (
              <Pressable
                onPress={() => Linking.openURL(item.reservationUrl!)}
                style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.actionBtnOutlinePressed]}
              >
                <ExternalLink size={16} color="#6366F1" />
                <Text style={styles.actionBtnOutlineText}>Book</Text>
              </Pressable>
            )}
            {(item.websiteUri || fetchedWebsiteUri) && (
              <Pressable
                onPress={() => Linking.openURL(item.websiteUri || fetchedWebsiteUri || "")}
                style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.actionBtnOutlinePressed]}
              >
                <ExternalLink size={16} color="#6366F1" />
                <Text style={styles.actionBtnOutlineText}>Website</Text>
              </Pressable>
            )}
            {item.instagram && (
              <Pressable
                onPress={() => Linking.openURL(`https://instagram.com/${item.instagram!.replace(/^@/, '')}`)}
                style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.actionBtnOutlinePressed]}
              >
                <Text style={styles.actionBtnOutlineText}>Instagram</Text>
              </Pressable>
            )}
            {item.tiktok && (
              <Pressable
                onPress={() => Linking.openURL(`https://tiktok.com/@${item.tiktok!.replace(/^@/, '')}`)}
                style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.actionBtnOutlinePressed]}
              >
                <Text style={styles.actionBtnOutlineText}>TikTok</Text>
              </Pressable>
            )}
            {isEvent && hasValidDate && (
              <Pressable onPress={handleAddToCalendar} style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.actionBtnOutlinePressed]}>
                <Calendar size={16} color="#6366F1" />
                <Text style={styles.actionBtnOutlineText}>Add to Calendar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {item.imageUri && !item.imageUri.startsWith("data:image") && !imageError && (
          <View style={styles.sourceSection}>
            <Text style={styles.sectionLabel}>Source</Text>
            <Pressable onPress={() => setScreenshotExpanded(true)} style={styles.sourceThumbnailContainer}>
              <Image source={{ uri: item.imageUri }} style={styles.sourceThumbnail} contentFit="cover" placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }} transition={200} cachePolicy="disk" onError={() => setImageError(true)} />
            </Pressable>
          </View>
        )}

        <Pressable onPress={handleRemove} style={styles.removeAction}>
          <Text style={styles.removeActionText}>Remove from saved</Text>
        </Pressable>

        {item.imageUri && !item.imageUri.startsWith("data:image") && !imageError && (
          <Modal visible={screenshotExpanded} transparent animationType="fade" onRequestClose={() => setScreenshotExpanded(false)}>
            <Pressable style={styles.screenshotOverlay} onPress={() => setScreenshotExpanded(false)}>
              <View style={styles.screenshotFullContainer}>
                <Image source={{ uri: item.imageUri }} style={styles.screenshotFull} contentFit="contain" cachePolicy="disk" />
              </View>
              <Pressable onPress={() => setScreenshotExpanded(false)} style={[styles.screenshotCloseBtn, { top: insets.top + 10 }]}>
                <X size={20} color="#fff" />
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  headerArea: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 4 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99, 102, 241, 0.1)" },
  headerBtnPressed: { opacity: 0.7 },
  headerRightIcons: { flexDirection: "row", gap: 8 },
  modalScrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  details: { gap: 12, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "700", color: Colors.light.text, letterSpacing: -0.5, lineHeight: 30, marginBottom: 4 },
  metaText: { fontSize: 14, color: Colors.light.mutedText, textTransform: "capitalize", lineHeight: 20 },
  liveStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  openNowBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  openNowBadgeOpen: { backgroundColor: "rgba(34, 197, 94, 0.12)" },
  openNowBadgeClosed: { backgroundColor: "rgba(118, 118, 128, 0.12)" },
  openNowTextOpen: { fontSize: 13, fontWeight: "600", color: "#22C55E" },
  openNowTextClosed: { fontSize: 13, fontWeight: "600", color: Colors.light.mutedText },
  openingHoursText: { fontSize: 13, color: Colors.light.mutedText },
  liveStatusLoading: { fontSize: 13, color: Colors.light.mutedText, marginTop: 6, fontStyle: "italic" },
  reviewSnippet: { fontSize: 13, color: Colors.light.mutedText, fontStyle: "italic", marginTop: 8, lineHeight: 18 },
  description: { fontSize: 14, lineHeight: 20, color: Colors.light.text, marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: Colors.light.mutedText, marginBottom: 10 },
  sourceSection: { marginTop: 8, marginBottom: 16 },
  sourceThumbnailContainer: { alignSelf: "flex-start" },
  sourceThumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: "#F2F2F7" },
  mapSection: { marginBottom: 16 },
  mapContainer: { height: 180, borderRadius: 16, overflow: "hidden", backgroundColor: "#F2F2F7" },
  map: { width: "100%", height: "100%" },
  mapMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  locationFallback: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#F9FAFB", borderRadius: 12 },
  locationFallbackText: { flex: 1, fontSize: 14, color: Colors.light.text },
  actions: { gap: 12, marginBottom: 20 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, backgroundColor: "#F2F2F7" },
  actionBtnOutlinePressed: { backgroundColor: "rgba(99, 102, 241, 0.1)" },
  actionBtnOutlineText: { fontSize: 14, fontWeight: "600", color: "#6366F1" },
  removeAction: { alignSelf: "center", paddingVertical: 12, paddingHorizontal: 16 },
  removeActionText: { fontSize: 14, fontWeight: "500", color: "rgba(239, 68, 68, 0.8)" },
  screenshotOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.95)", justifyContent: "center", alignItems: "center" },
  screenshotFullContainer: { width: "95%", height: "80%" },
  screenshotFull: { width: "100%", height: "100%" },
  screenshotCloseBtn: { position: "absolute", right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255, 255, 255, 0.15)", alignItems: "center", justifyContent: "center" },
});
