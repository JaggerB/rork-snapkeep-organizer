import Colors from "@/constants/colors";
import { useAuth } from "@/providers/auth";
import { useSavedItems, SavedItem } from "@/providers/saved-items";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useFocusEffect } from "expo-router";
import {
  MapPin,
  Plus,
  Trash2,
  Settings,
  Check,
} from "lucide-react-native";
import { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  FlatList,
  Alert,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_COLLAPSED = 64;
const SHEET_HALF = SCREEN_HEIGHT * 0.4;
const SHEET_FULL = SCREEN_HEIGHT * 0.7;

// Lazy require for native maps
let NativeMapView: any = null;
let NativeMarker: any = null;
if (Platform.OS !== "web") {
  try {
    const RNMaps = require("react-native-maps");
    NativeMapView = RNMaps.default;
    NativeMarker = RNMaps.Marker;
  } catch (e) {
    console.warn("[MapScreen] Failed to load react-native-maps", e);
  }
}

function getCategoryEmoji(category?: string | null, title?: string | null): string {
  const combined = `${category || ""} ${title || ""}`.toLowerCase();
  if (combined.includes("coffee") || combined.includes("cafe") || combined.includes("café")) return "☕";
  if (combined.includes("bakery") || combined.includes("bakeries") || combined.includes("boulangerie")) return "🥐";
  const c = (category || "").toLowerCase();
  if (c === "restaurant" || c === "food") return "🍽️";
  if (c === "bar") return "🍸";
  if (c.includes("pizza")) return "🍕";
  if (c.includes("burger")) return "🍔";
  if (c.includes("sushi")) return "🍣";
  if (c === "event" || c.includes("events")) return "🎫";
  if (c === "nightlife") return "🎉";
  if (c.includes("concert")) return "🎵";
  if (c.includes("festival")) return "🎪";
  if (c.includes("sport") || c.includes("race") || c.includes("f1")) return "🏎️";
  if (c === "museum") return "🏛️";
  if (c === "attraction" || c.includes("date night")) return "🗽";
  if (c.includes("art") || c.includes("gallery")) return "🎨";
  if (c === "hike" || c.includes("hikes")) return "🥾";
  if (c === "beach") return "🏖️";
  if (c === "park") return "🌳";
  if (c.includes("nature")) return "🌲";
  if (c === "hotel") return "🏨";
  if (c.includes("travel")) return "✈️";
  if (c === "shop" || c.includes("shopping")) return "🛍️";
  if (c === "wellness") return "💆";
  if (c === "activity") return "🎯";
  return "📍";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface UpcomingContext {
  snippet: string;
  itemId: string;
}

function generateCatchySnippet(item: SavedItem, diffDays: number, diffHours: number): string {
  const title = item.title || "event";
  const category = item.category?.toLowerCase() || "";
  if (title.toLowerCase().includes("f1") || title.toLowerCase().includes("formula") || title.toLowerCase().includes("grand prix")) {
    if (diffHours < 24) return "🏎️ Lights out soon!";
    if (diffDays === 1) return "🏎️ Lights out tomorrow!";
    if (diffDays < 7) return `🏎️ ${diffDays} days to lights out`;
    return "🏎️ Race day approaching";
  }
  if (category === "event" && (title.toLowerCase().includes("concert") || title.toLowerCase().includes("tour") || title.toLowerCase().includes("live"))) {
    if (diffHours < 24) return "🎵 Showtime tonight!";
    if (diffDays === 1) return "🎵 Showtime tomorrow!";
    if (diffDays < 7) return `🎵 ${diffDays} days until showtime`;
    return "🎵 Show coming up";
  }
  if (title.toLowerCase().includes("festival") || title.toLowerCase().includes("fest")) {
    if (diffHours < 24) return "🎉 Festival kicks off today!";
    if (diffDays === 1) return "🎉 Festival starts tomorrow!";
    if (diffDays < 7) return `🎉 ${diffDays} days to festival`;
    return "🎉 Festival on the horizon";
  }
  if (category === "event" && (title.toLowerCase().includes("match") || title.toLowerCase().includes("game") || title.toLowerCase().includes("cup"))) {
    if (diffHours < 24) return "⚽ Game day!";
    if (diffDays === 1) return "⚽ Game day tomorrow!";
    if (diffDays < 7) return `⚽ ${diffDays} days to kick off`;
    return "⚽ Match coming up";
  }
  if (diffHours < 24) return `✨ ${title.split(' ').slice(0, 3).join(' ')} today!`;
  if (diffDays === 1) return `✨ ${title.split(' ').slice(0, 3).join(' ')} tomorrow`;
  if (diffDays < 7) return `✨ ${diffDays} days until ${title.split(' ').slice(0, 2).join(' ')}`;
  return `✨ ${title.split(' ').slice(0, 3).join(' ')} coming up`;
}

function getUpcomingContext(items: SavedItem[]): UpcomingContext | null {
  const now = new Date();
  const upcoming = items
    .filter(item => item.dateTimeISO && new Date(item.dateTimeISO) > now)
    .sort((a, b) => new Date(a.dateTimeISO!).getTime() - new Date(b.dateTimeISO!).getTime());
  if (upcoming.length === 0) return null;
  const next = upcoming[0];
  const nextDate = new Date(next.dateTimeISO!);
  const diffMs = nextDate.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return { snippet: generateCatchySnippet(next, diffDays, diffHours), itemId: next.id };
}

const PlaceItem = memo(function PlaceItem({ item, isSelected, onPress, onDelete }: { item: SavedItem; isSelected: boolean; onPress: () => void; onDelete: () => void }) {
  const swipeableRef = useRef<Swipeable>(null);
  const handleDelete = () => {
    Alert.alert("Delete Place", `Are you sure you want to delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel", onPress: () => swipeableRef.current?.close() },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };
  return (
    <Swipeable ref={swipeableRef} renderRightActions={() => (
      <Pressable style={styles.swipeDeleteBtn} onPress={handleDelete}>
        <Trash2 size={22} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    )} overshootRight={false} rightThreshold={40} containerStyle={styles.swipeableContainer}>
      <Pressable onPress={onPress} onLongPress={handleDelete} delayLongPress={500} style={({ pressed }) => [styles.placeItem, pressed && styles.placeItemPressed]}>
        <View style={styles.placeThumbnailContainer}>
          {item.imageUri && !item.imageUri.startsWith("data:image") ? (
            <Image source={{ uri: item.imageUri }} style={styles.placeThumbnail} contentFit="cover" placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }} transition={200} cachePolicy="disk" recyclingKey={item.id} />
          ) : (
            <View style={styles.placeThumbnailPlaceholder}>
              <Text style={styles.placeEmoji}>{getCategoryEmoji(item.category, item.title)}</Text>
            </View>
          )}
        </View>
        <View style={styles.placeContent}>
          <Text style={styles.placeTitle}>{item.title}</Text>
          <Text style={styles.placeCategory}>
            {item.category || "Saved"}
            {item.dateTimeISO && !isNaN(new Date(item.dateTimeISO).getTime()) && ` · ${new Date(item.dateTimeISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </Text>
        </View>
        {isSelected && <View style={styles.checkBadge}><Check size={14} color="#fff" strokeWidth={3} /></View>}
      </Pressable>
    </Swipeable>
  );
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { items, isLoading, removeItem, refreshItems } = useSavedItems();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "thisWeek" | "upcoming">("all");
  const sheetAnim = useRef(new Animated.Value(0.5)).current; // 0=collapsed, 0.5=half, 1=full
  const sheetPositionRef = useRef(0.5);
  const dragStartRef = useRef(0.5);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const mapRef = useRef<any>(null);
  const greeting = getGreeting();
  const getFirstName = () => {
    const fullName = user?.user_metadata?.full_name;
    if (fullName) { const firstName = fullName.split(' ')[0]; return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(); }
    const email = user?.email;
    if (email) { const emailName = email.split('@')[0].split('.')[0].split(/[0-9]/)[0]; return emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase(); }
    return "there";
  };
  const userName = getFirstName();
  const lastRefreshRef = useRef<number>(0);
  useFocusEffect(useCallback(() => {
    lastRefreshRef.current = Date.now();
    refreshItems();
  }, [refreshItems]));
  const upcomingContext = useMemo(() => getUpcomingContext(items), [items]);

  const getCoords = useCallback((item: SavedItem): { latitude: number; longitude: number } | null => {
    const c = item.coordinates;
    if (!c || typeof c !== "object") return null;
    const o = c as Record<string, unknown>;
    const lat = Number(o.latitude ?? o.lat);
    const lng = Number(o.longitude ?? o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, []);

  const locationItems = useMemo(
    () => items.filter(item => getCoords(item) != null),
    [items, getCoords]
  );
  const categorizedItems = useMemo(() => {
    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    if (activeFilter === "thisWeek") return items.filter(item => item.dateTimeISO && (() => { const d = new Date(item.dateTimeISO); return d >= now && d <= endOfWeek; })());
    if (activeFilter === "upcoming") return items.filter(item => item.dateTimeISO && new Date(item.dateTimeISO) > endOfWeek);
    return items;
  }, [items, activeFilter]);
  const initialRegion = useMemo(() => {
    if (locationItems.length === 0) return { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    const lats = locationItems.map(it => getCoords(it)!.latitude);
    const lngs = locationItems.map(it => getCoords(it)!.longitude);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.02, (Math.max(...lats) - Math.min(...lats)) * 1.5),
      longitudeDelta: Math.max(0.02, (Math.max(...lngs) - Math.min(...lngs)) * 1.5),
    };
  }, [locationItems]);
  useEffect(() => {
    if (mapRef.current && locationItems.length > 0) {
      const coordinates = locationItems.map(item => getCoords(item)!);
      setTimeout(() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 100, right: 50, bottom: SCREEN_HEIGHT * 0.45, left: 50 }, animated: true }), 500);
    }
  }, [locationItems]);
  const snapSheet = useCallback((pos: number) => {
    const snapped = pos < 0.25 ? 0 : pos < 0.625 ? 0.5 : 1;
    sheetPositionRef.current = snapped;
    setIsSheetCollapsed(snapped === 0);
    Animated.spring(sheetAnim, { toValue: snapped, useNativeDriver: false, tension: 65, friction: 11 }).start();
  }, [sheetAnim]);

  const toggleSheet = useCallback(() => {
    const current = sheetPositionRef.current;
    const next = current === 0 ? 0.5 : current === 0.5 ? 1 : 0.5;
    sheetPositionRef.current = next;
    setIsSheetCollapsed(next === 0);
    Animated.spring(sheetAnim, { toValue: next, useNativeDriver: false, tension: 65, friction: 11 }).start();
  }, [sheetAnim]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
    onPanResponderGrant: () => { dragStartRef.current = sheetPositionRef.current; },
    onPanResponderMove: (_, g) => {
      const delta = -g.dy / SCREEN_HEIGHT;
      const raw = dragStartRef.current + delta;
      const clamped = Math.max(0, Math.min(1, raw));
      sheetAnim.setValue(clamped);
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dy) < 10) {
        toggleSheet();
        return;
      }
      const delta = -g.dy / SCREEN_HEIGHT;
      const raw = dragStartRef.current + delta;
      const clamped = Math.max(0, Math.min(1, raw));
      const velocity = -g.vy / 1000;
      const withVelocity = clamped + velocity * 0.3;
      snapSheet(Math.max(0, Math.min(1, withVelocity)));
    },
  }), [sheetAnim, snapSheet, toggleSheet]);

  const sheetHeight = sheetAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [SHEET_COLLAPSED, SHEET_HALF, SHEET_FULL],
  });
  const fabOpacity = sheetAnim.interpolate({
    inputRange: [0, 0.15, 0.5],
    outputRange: [0, 0, 1],
  });
  const fabBottom = sheetAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [insets.bottom + 16, insets.bottom + SHEET_HALF - 28, insets.bottom + SHEET_FULL - 28],
  });
  const handleItemPress = useCallback((item: SavedItem) => router.push({ pathname: "/modal", params: { id: item.id } }), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.mapContainer}>
          {NativeMapView ? (
            <NativeMapView key={`home-map-${locationItems.length}`} ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation={true} showsMyLocationButton={false} showsCompass={false}>
              {locationItems.map(item => {
                const coords = getCoords(item);
                return coords ? (
                <NativeMarker key={item.id} coordinate={coords} onPress={() => handleItemPress(item)} tracksViewChanges={false}>
                  <View style={[styles.marker, selectedId === item.id && styles.markerSelected]}>
                    <Text style={styles.markerEmoji}>{getCategoryEmoji(item.category, item.title)}</Text>
                  </View>
                </NativeMarker>
                ) : null;
              })}
            </NativeMapView>
          ) : (
            <LinearGradient colors={['#E8F4FD', '#D0E8FC', '#B8DCFA']} style={styles.mapPlaceholder} />
          )}
          {locationItems.length > 0 && <View style={styles.focusCircle} pointerEvents="none"><View style={styles.focusCircleInner} /></View>}
        </View>
        <LinearGradient colors={['rgba(99, 102, 241, 0.95)', 'rgba(139, 92, 246, 0.85)', 'transparent']} style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerContent}>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.nameText}>{userName}</Text>
            {upcomingContext && (
              <Pressable onPress={() => router.push({ pathname: "/modal", params: { id: upcomingContext.itemId } })} style={({ pressed }) => [styles.contextButton, pressed && styles.contextButtonPressed]}>
                <Text style={styles.contextText}>{upcomingContext.snippet}</Text>
              </Pressable>
            )}
            {!upcomingContext && items.length > 0 && <Text style={styles.contextText}>{items.length} places saved to explore</Text>}
          </View>
        </LinearGradient>
        <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>
          <View style={styles.sheetHandle} {...panResponder.panHandlers}>
            <View style={styles.sheetHandleBar} />
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterTabs}>
              <Pressable onPress={() => setActiveFilter("all")} style={[styles.filterTab, activeFilter === "all" && styles.filterTabActive]}><Text style={[styles.filterTabText, activeFilter === "all" && styles.filterTabTextActive]}>All</Text></Pressable>
              <Pressable onPress={() => setActiveFilter("thisWeek")} style={[styles.filterTab, activeFilter === "thisWeek" && styles.filterTabActive]}><Text style={[styles.filterTabText, activeFilter === "thisWeek" && styles.filterTabTextActive]}>This Week</Text></Pressable>
              <Pressable onPress={() => setActiveFilter("upcoming")} style={[styles.filterTab, activeFilter === "upcoming" && styles.filterTabActive]}><Text style={[styles.filterTabText, activeFilter === "upcoming" && styles.filterTabTextActive]}>Upcoming</Text></Pressable>
            </View>
            <View style={styles.filterRight}>
              <Pressable onPress={() => router.push("/settings")} style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}><Settings size={20} color={Colors.light.mutedText} /></Pressable>
            </View>
          </View>
          {isLoading && !categorizedItems.length ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Loading...</Text></View>
          ) : categorizedItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{activeFilter === "all" ? "🗺️" : activeFilter === "thisWeek" ? "📅" : "🔮"}</Text>
              <Text style={styles.emptyTitle}>{activeFilter === "all" ? "No places yet" : activeFilter === "thisWeek" ? "Nothing this week" : "No upcoming events"}</Text>
              <Text style={styles.emptyText}>{activeFilter === "all" ? "Add screenshots of places you want to visit" : "Events with dates will appear here"}</Text>
            </View>
          ) : (
            <FlatList
              data={categorizedItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <PlaceItem item={item} isSelected={selectedId === item.id} onPress={() => handleItemPress(item)} onDelete={() => removeItem(item.id)} />
              )}
              style={styles.placesList}
              contentContainerStyle={styles.placesListContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={5}
              windowSize={3}
              initialNumToRender={6}
            />
          )}
        </Animated.View>
        <Animated.View pointerEvents={isSheetCollapsed ? "none" : "box-none"} style={[styles.fabContainer, { bottom: fabBottom, opacity: fabOpacity }]}>
          <Pressable onPress={() => router.push("/collect")} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
            <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabGradient}>
              <Plus size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.fabText}>Add a place to visit</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.light.background },
  mapContainer: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1 },
  focusCircle: { position: "absolute", top: "30%", left: "50%", marginLeft: -75, width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: "rgba(99, 102, 241, 0.5)", alignItems: "center", justifyContent: "center" },
  focusCircleInner: { width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(99, 102, 241, 0.15)" },
  marker: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, borderWidth: 2, borderColor: "#fff" },
  markerSelected: { borderColor: "#6366F1", borderWidth: 3, transform: [{ scale: 1.1 }] },
  markerEmoji: { fontSize: 22 },
  headerGradient: { position: "absolute", top: 0, left: 0, right: 0, paddingBottom: 60 },
  headerContent: { alignItems: "center", paddingHorizontal: 20 },
  greetingText: { fontSize: 16, fontWeight: "500", color: "rgba(255,255,255,0.9)", textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  nameText: { fontSize: 28, fontWeight: "700", color: "#fff", letterSpacing: -0.5, textShadowColor: "rgba(0,0,0,0.1)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4, marginTop: 2 },
  contextButton: { marginTop: 6, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: "center" },
  contextButtonPressed: { opacity: 0.7 },
  contextText: { fontSize: 14, color: "#fff", fontWeight: "600" },
  bottomSheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 20, overflow: "hidden" },
  sheetHandle: { alignItems: "center", paddingVertical: 16, minHeight: 44 },
  sheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E5EA" },
  filterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  filterTabs: { flex: 1, flexDirection: "row", gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#F2F2F7" },
  filterTabActive: { backgroundColor: "#6366F1" },
  filterTabText: { fontSize: 14, fontWeight: "600", color: Colors.light.mutedText },
  filterTabTextActive: { color: "#fff" },
  filterRight: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  iconBtnPressed: { opacity: 0.7 },
  placesList: { flex: 1 },
  placesListContent: { paddingBottom: 100 },
  placeItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)", gap: 14, backgroundColor: "#fff" },
  placeItemPressed: { opacity: 0.7 },
  swipeableContainer: { backgroundColor: "#FF3B30" },
  placeThumbnailContainer: { width: 52, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: "#F2F2F7" },
  placeThumbnail: { width: 52, height: 52 },
  placeThumbnailPlaceholder: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  placeEmoji: { fontSize: 24 },
  placeContent: { flex: 1 },
  placeTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.text, marginBottom: 2 },
  placeCategory: { fontSize: 13, color: Colors.light.mutedText, textTransform: "capitalize", marginTop: 2 },
  checkBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  swipeDeleteBtn: { backgroundColor: "#FF3B30", justifyContent: "center", alignItems: "center", width: 90, flexDirection: "column", gap: 4 },
  swipeDeleteText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.light.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.light.mutedText, textAlign: "center" },
  fabContainer: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: { borderRadius: 28, shadowColor: "#6366F1", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  fabGradient: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 28 },
  fabText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
