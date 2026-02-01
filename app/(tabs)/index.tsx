import Colors from "@/constants/colors";
import { useAuth } from "@/providers/auth";
import { useSavedItems, SavedItem } from "@/providers/saved-items";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import {
  Bookmark,
  Calendar,
  LogOut,
  MapPin,
  Plus,
  Map,
} from "lucide-react-native";
import { useMemo, useState, useCallback, useEffect } from "react";
import MapView, { Marker } from "react-native-maps";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";




type DoFilter = "All" | "This Week" | "Upcoming" | "Anytime" | "Map";


function isDoItem(item: SavedItem): boolean {
  const cat = (item.category || "").toLowerCase();
  const title = (item.title || "").toLowerCase();
  const notes = (item.notes || "").toLowerCase();
  const source = (item.source || "").toLowerCase();
  const combined = `${cat} ${title} ${notes} ${source}`;

  // First, check if this is clearly a Think item - these should NEVER be in Do
  const thinkExclusions = [
    "domain", "url", "website", "godaddy", "namecheap", "hosting",
    "shop", "shopping", "buy now", "purchase", "add to cart", "checkout",
    "product", "price", "$", "sale", "discount", "deal", "off",
    "course", "tutorial", "article", "blog", "read", "learn",
    "movie", "film", "netflix", "streaming", "watch", "series", "episode",
    "podcast", "listen", "spotify", "youtube",
    "recipe", "diy", "how to", "tip", "hack",
    "amazon", "etsy", "ebay", "shopify", "store",
    "fashion", "clothing", "outfit", "shoes", "accessories",
    "furniture", "decor", "gadget", "tech", "electronics",
    "app", "software", "tool", "subscription"
  ];

  const isClearlyThink = thinkExclusions.some(kw => combined.includes(kw));
  if (isClearlyThink) {
    return false;
  }

  // Do keywords - things you physically go to or attend
  const doKeywords = [
    "event", "events", "travel", "trip", "date night",
    "restaurant", "hike", "hikes", "hiking",
    "exhibition", "exhibit", "concert", "festival",
    "museum", "gallery", "theater", "theatre", "performance",
    "reservation", "booking", "tickets", "ticket",
    "bar", "cafe", "coffee shop", "brunch", "dinner", "lunch",
    "experience", "tour", "activity", "adventure",
    "visit", "venue", "location", "popup", "pop-up"
  ];

  const hasDoKeyword = doKeywords.some(kw => combined.includes(kw));

  // Has a specific date/time = likely actionable
  const hasDateTime = !!item.dateTimeISO;

  // Category signals
  const doCategories = ["events", "travel", "date night", "hikes", "food"];
  const hasDoCat = doCategories.some(c => cat.includes(c));

  return hasDoKeyword || hasDateTime || hasDoCat;
}

function isThinkItem(item: SavedItem): boolean {
  const cat = (item.category || "").toLowerCase();
  const title = (item.title || "").toLowerCase();
  const notes = (item.notes || "").toLowerCase();
  const source = (item.source || "").toLowerCase();
  const combined = `${cat} ${title} ${notes} ${source}`;

  const thinkKeywords = [
    // Shopping / Buy
    "shop", "shopping", "buy", "purchase", "product", "price",
    "sale", "discount", "deal", "amazon", "etsy", "ebay",
    "domain", "url", "website", "godaddy", "namecheap", "hosting",
    "add to cart", "checkout", "order",
    // Learning
    "learn", "learning", "course", "tutorial", "article", "blog",
    "education", "class", "lesson", "guide",
    // Media
    "movie", "movies", "film", "watch", "netflix", "streaming",
    "series", "episode", "documentary",
    "read", "reading", "book", "podcast", "listen", "spotify",
    "youtube", "video",
    // Tech / Products
    "app", "tool", "software", "tech", "gadget", "electronics",
    "subscription", "service",
    // Ideas
    "idea", "inspiration", "save for later", "remember", "bookmark",
    "recipe", "diy", "how to", "tip", "hack",
    // Fashion / Home
    "fashion", "style", "outfit", "clothing", "shoes", "accessories",
    "furniture", "decor", "home", "design", "interior"
  ];

  // Category signals
  const thinkCategories = ["shopping", "movies", "other"];
  const hasThinkCat = thinkCategories.some(c => cat.includes(c));

  return thinkKeywords.some(kw => combined.includes(kw)) || hasThinkCat;
}

function getThinkTag(item: SavedItem): "Buy" | "Learn" {
  const cat = (item.category || "").toLowerCase();
  const title = (item.title || "").toLowerCase();
  const notes = (item.notes || "").toLowerCase();
  const source = (item.source || "").toLowerCase();
  const combined = `${cat} ${title} ${notes} ${source}`;

  const buyKeywords = [
    "shop", "shopping", "buy", "purchase", "product",
    "price", "sale", "discount", "deal", "$",
    "domain", "url", "godaddy", "namecheap", "hosting",
    "add to cart", "checkout", "order",
    "fashion", "style", "outfit", "clothing", "shoes",
    "furniture", "decor", "gadget", "tech", "electronics",
    "amazon", "etsy", "ebay", "shopify",
    "subscription", "service", "plan"
  ];

  if (buyKeywords.some(kw => combined.includes(kw))) return "Buy";
  return "Learn";
}

function formatTimeContext(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) return null;
  if (diffHours <= 0) return "Happening now";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


function isThisWeekItem(item: SavedItem): boolean {
  if (!item.dateTimeISO) return false;
  const date = new Date(item.dateTimeISO);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Allow items from 2 hours ago up to 7 days in future
  return diffDays >= -0.08 && diffDays <= 7;
}

function isUpcomingItem(item: SavedItem): boolean {
  if (!item.dateTimeISO) return false;
  const date = new Date(item.dateTimeISO);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

function isAnytimeItem(item: SavedItem): boolean {
  return !item.dateTimeISO;
}

function DoCard({ item }: { item: SavedItem }) {
  const [imageError, setImageError] = useState(false);
  const handlePress = useCallback(() => {
    router.push({ pathname: "/modal", params: { id: item.id } });
  }, [item.id]);

  console.log("[DoCard] item:", item.id, "imageUri:", item.imageUri ? item.imageUri.substring(0, 50) + "..." : "null");

  const timeContext = formatTimeContext(item.dateTimeISO);
  const cat = (item.category || "").toLowerCase();
  const isEvent = cat.includes("event") || cat.includes("date");
  const hasLocation = !!item.coordinates || !!item.mapsUrl;

  const handlePrimaryAction = useCallback(() => {
    if (isEvent && item.dateTimeISO) {
      const title = encodeURIComponent(item.title);
      const startDate = new Date(item.dateTimeISO).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const endDate = new Date(new Date(item.dateTimeISO).getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}`;
      Linking.openURL(url);
    } else if (hasLocation) {
      if (item.mapsUrl) {
        Linking.openURL(item.mapsUrl);
      } else if (item.coordinates) {
        const url = Platform.select({
          ios: `maps:0,0?q=${item.coordinates.latitude},${item.coordinates.longitude}`,
          android: `geo:${item.coordinates.latitude},${item.coordinates.longitude}`,
          default: `https://www.google.com/maps?q=${item.coordinates.latitude},${item.coordinates.longitude}`,
        });
        Linking.openURL(url);
      }
    }
  }, [item, isEvent, hasLocation]);

  return (
    <Pressable
      style={({ pressed }) => [styles.doCard, pressed && styles.cardPressed]}
      onPress={handlePress}
      testID={`do_item_${item.id}`}
    >
      <View style={styles.doCardThumbContainer}>
        <View style={styles.doCardThumb}>
          {item.imageUri && !imageError ? (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.doCardImage}
              contentFit="cover"
              onError={(e) => {
                console.log("[DoCard] image error for", item.id, e);
                setImageError(true);
              }}
            />
          ) : (
            <View style={styles.doCardPlaceholder}>
              <Bookmark size={14} color="rgba(11, 18, 32, 0.15)" />
            </View>
          )}
        </View>
      </View>
      <View style={styles.doCardContent}>
        <Text style={styles.doCardTitle}>{item.title}</Text>
        <View style={styles.doCardMeta}>
          {item.location && (
            <Text numberOfLines={1} style={styles.doCardLocation}>{item.location}</Text>
          )}
          {timeContext && (
            <Text style={styles.doCardTime}>{timeContext}</Text>
          )}
        </View>
      </View>
      {(isEvent || hasLocation) && (
        <Pressable
          style={({ pressed }) => [styles.doCardAction, pressed && styles.doCardActionPressed]}
          onPress={handlePrimaryAction}
          hitSlop={8}
        >
          {isEvent ? (
            <Calendar size={16} color={Colors.light.tint} />
          ) : (
            <MapPin size={16} color={Colors.light.tint} />
          )}
        </Pressable>
      )}
    </Pressable>
  );
}





// Dynamic import for Web Maps to avoid Native crashes
let WebGoogleMap: any, WebLoadScript: any, WebMarker: any;
if (Platform.OS === "web") {
  try {
    const lib = require("@react-google-maps/api");
    WebGoogleMap = lib.GoogleMap;
    WebLoadScript = lib.LoadScript;
    WebMarker = lib.Marker;
  } catch (e) {
    console.warn("Failed to load @react-google-maps/api", e);
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '16px',
};

function WebMap({ items }: { items: SavedItem[] }) {
  const locationItems = items.filter((it) => !!it.coordinates);
  const [map, setMap] = useState<any>(null);

  const onLoad = useCallback((mapInstance: any) => {
    setMap(mapInstance);
  }, []);

  const center = useMemo(() => {
    if (locationItems.length === 0) {
      return { lat: -37.8136, lng: 144.9631 }; // Melbourne
    }
    const lats = locationItems.map(it => it.coordinates!.latitude);
    const lngs = locationItems.map(it => it.coordinates!.longitude);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }, [locationItems]);

  // Adjust bounds when items or map changes
  useEffect(() => {
    if (map && locationItems.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      locationItems.forEach(item => {
        bounds.extend({ lat: item.coordinates!.latitude, lng: item.coordinates!.longitude });
      });
      map.fitBounds(bounds);

      // If only one marker or very close, zoom might be too high. Adjust if needed.
      // We use a listener for 'idle' to check zoom after bounds fit, 
      // but simple fitBounds is usually enough. 
      // For single items, fitBounds can zoom in MAX_ZOOM.
      // Google Maps usually handles this but let's be safe.
      if (locationItems.length === 1) {
        // Force a reasonable zoom for single item if fitBounds goes too crazy
        // Actually fitBounds with one point is effectively setCenter. 
        // We can set a max zoom/listener, but let's try default fitBounds behavior first.
        // Note: fitBounds with 1 point might yield max zoom. 
        // Better:
        map.setZoom(15);
        map.setCenter({ lat: locationItems[0].coordinates!.latitude, lng: locationItems[0].coordinates!.longitude });
      }
    }
  }, [map, locationItems]);


  if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
    return (
      <View style={styles.webMapFallback}>
        <Text style={styles.webMapFallbackTitle}>API Key Missing</Text>
      </View>
    );
  }

  // If libraries failed to load
  if (!WebGoogleMap || !WebLoadScript) {
    return (
      <View style={styles.webMapFallback}>
        <Text style={styles.webMapFallbackTitle}>Map Library Error</Text>
        <Text>Could not load Google Maps library.</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapViewContainer}>
      <WebLoadScript googleMapsApiKey={process.env.EXPO_PUBLIC_GEMINI_API_KEY || ""}>
        <WebGoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
          onLoad={onLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
          }}
        >
          {locationItems.map(item => (
            <WebMarker
              key={item.id}
              position={{
                lat: item.coordinates!.latitude,
                lng: item.coordinates!.longitude
              }}
              label={{
                text: getCategoryEmoji(item.category),
                fontSize: "24px",
                className: "emoji-marker-label" // Optional if we had CSS
              }}
              title={item.title}
              onClick={() => router.push({ pathname: "/modal", params: { id: item.id } })}
            />
          ))}
        </WebGoogleMap>
      </WebLoadScript>
    </View>
  );
}

// Helper for emoji mapping
function getCategoryEmoji(category?: string | null): string {
  const c = (category || "").toLowerCase();

  // Specific food types
  if (c.includes("pizza")) return "🍕";
  if (c.includes("burger")) return "🍔";
  if (c.includes("sushi")) return "🍣";
  if (c.includes("bakery") || c.includes("bread") || c.includes("pastry")) return "🥐";
  if (c.includes("ice cream")) return "🍦";

  // General Food/Drink
  if (c.includes("food") || c.includes("restaurant") || c.includes("dinner") || c.includes("lunch")) return "🍽️";
  if (c.includes("bar") || c.includes("pub") || c.includes("alcohol")) return "🍺";
  if (c.includes("wine")) return "🍷";
  if (c.includes("cocktail")) return "🍸";
  if (c.includes("coffee") || c.includes("cafe")) return "☕";

  // Events/Activities
  if (c.includes("event") || c.includes("concert") || c.includes("music")) return "🎫";
  if (c.includes("art") || c.includes("museum") || c.includes("gallery")) return "🎨";
  if (c.includes("movie") || c.includes("cinema") || c.includes("film")) return "🎬";

  // Outdoors/Travel
  if (c.includes("hike") || c.includes("hiking") || c.includes("nature") || c.includes("park")) return "🌲";
  if (c.includes("beach")) return "🏖️";
  if (c.includes("travel") || c.includes("hotel") || c.includes("stay")) return "✈️";

  // Shopping
  if (c.includes("shop") || c.includes("store") || c.includes("buy")) return "🛍️";

  return "📍";
}

function DoMapView({ items }: { items: SavedItem[] }) {
  const locationItems = items.filter((it) => !!it.coordinates);
  const insets = useSafeAreaInsets();

  console.log("[DoMapView] Rendering. Platform:", Platform.OS);
  console.log("[DoMapView] Total Items:", items.length);
  console.log("[DoMapView] Location Items:", locationItems.length);
  if (locationItems.length > 0) {
    console.log("[DoMapView] First Item Category:", locationItems[0].category, "Emoji:", getCategoryEmoji(locationItems[0].category));
  }

  const initialRegion = useMemo(() => {
    // Default to Melbourne if no items
    if (locationItems.length === 0) {
      return {
        latitude: -37.8136,
        longitude: 144.9631,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    const lats = locationItems.map((it) => it.coordinates!.latitude);
    const lngs = locationItems.map((it) => it.coordinates!.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add some padding
    const latDelta = (maxLat - minLat) * 1.5;
    const lngDelta = (maxLng - minLng) * 1.5;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, latDelta),
      longitudeDelta: Math.max(0.05, lngDelta),
    };
  }, [locationItems]);

  const handleMarkerPress = useCallback((item: SavedItem) => {
    router.push({ pathname: "/modal", params: { id: item.id } });
  }, []);

  if (Platform.OS === "web") {
    return <WebMap items={items} />;
  }

  return (
    <View style={styles.mapViewContainer}>
      <MapView
        style={styles.mapView}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        provider={undefined} // Use default (Apple Maps on iOS, Google on Android)
      >
        {locationItems.map((item) => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: item.coordinates!.latitude,
              longitude: item.coordinates!.longitude,
            }}
            title={item.title}
            description={item.location || undefined}
            onCalloutPress={() => handleMarkerPress(item)}
          >
            <View style={styles.emojiMarker}>
              <Text style={styles.emojiText}>{getCategoryEmoji(item.category)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      {locationItems.length === 0 && (
        <View style={[styles.mapEmptyOverlay, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.mapEmptyCard}>
            <MapPin size={20} color="rgba(11, 18, 32, 0.3)" />
            <Text style={styles.mapEmptyText}>No places saved yet</Text>
          </View>
        </View>
      )}
    </View>
  );
}


function DoSection({
  items,
  filter,
  onFilterChange
}: {
  items: SavedItem[];
  filter: DoFilter;
  onFilterChange: (f: DoFilter) => void;
}) {
  const filters: DoFilter[] = ["All", "This Week", "Upcoming", "Anytime", "Map"];

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "All":
        return items;
      case "This Week":
        return items.filter(isThisWeekItem);
      case "Upcoming":
        return items.filter(isUpcomingItem);
      case "Anytime":
        return items.filter(isAnytimeItem);
      case "Map":
        return items.filter((it) => !!it.coordinates || !!it.location);
      default:
        return items;
    }
  }, [items, filter]);

  if (filter === "Map") {
    return (
      <View style={styles.doSection}>

        <View style={styles.pillRow}>
          {filters.map((f) => (
            <Pressable
              key={f}
              onPress={() => onFilterChange(f)}
              style={[styles.pill, filter === f && styles.pillActive]}
            >
              {f === "Map" && <Map size={12} color={filter === f ? "#fff" : "rgba(11, 18, 32, 0.5)"} />}
              <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>
        <DoMapView items={items} />
      </View>
    );
  }

  return (
    <View style={styles.doSection}>

      <View style={styles.pillRow}>
        {filters.map((f) => {
          const isActive = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => onFilterChange(f)}
              style={[styles.pill, isActive && styles.pillActive]}
            >
              {f === "Map" && <Map size={12} color={isActive ? "#fff" : "rgba(11, 18, 32, 0.5)"} />}
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>
      {filteredItems.length === 0 ? (
        <View style={styles.doEmptyState}>
          <View style={styles.doEmptyIcon}>
            <Calendar size={20} color="rgba(11, 18, 32, 0.25)" />
          </View>
          <Text style={styles.doEmptyText}>
            {filter === "This Week" ? "Nothing happening this week" :
              filter === "Upcoming" ? "Nothing coming up later" :
                filter === "Anytime" ? "No undated items" : "Nothing found"}
          </Text>
          <Pressable
            onPress={() => router.push("/collect")}
            style={styles.doEmptyAction}
          >
            <Plus size={14} color={Colors.light.tint} />
            <Text style={styles.doEmptyActionText}>Add a plan</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.doList}>
          {filteredItems.map((item) => (
            <DoCard key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}



export default function LibraryScreen() {
  const { items, isLoading } = useSavedItems();
  const { user, signOut } = useAuth();
  const [doFilter, setDoFilter] = useState<DoFilter>("All");
  const insets = useSafeAreaInsets();

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.dateTimeISO && b.dateTimeISO) {
        return new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime();
      }
      if (a.dateTimeISO) return -1;
      if (b.dateTimeISO) return 1;
      return 0;
    });
  }, [items]);

  const empty = items.length === 0;

  return (
    <View style={styles.root} testID="libraryScreen">
      <Stack.Screen options={{ title: "", headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={Platform.OS === "web"}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Your Plans</Text>
              {user && <Text style={styles.userEmail}>{user.email}</Text>}
            </View>
            <Pressable
              onPress={signOut}
              style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
              hitSlop={8}
              testID="signOutButton"
            >
              <LogOut size={20} color={Colors.light.mutedText} />
            </Pressable>
          </View>
        </View>



        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : empty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Bookmark size={32} color={Colors.light.tint} />
            </View>
            <Text style={styles.emptyTitle}>Start your collection</Text>
            <Text style={styles.emptyText}>
              Save screenshots of places, events, and ideas you want to explore later.
            </Text>
            <Pressable
              onPress={() => router.push("/collect")}
              style={styles.emptyButton}
              testID="emptyAddButton"
            >
              <Plus size={18} color="#fff" />
              <Text style={styles.emptyButtonText}>Add first save</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.sectionsWrap}>
            <DoSection items={sortedItems} filter={doFilter} onFilterChange={setDoFilter} />
          </View>
        )}
      </ScrollView>

      {!empty && (
        <Pressable
          onPress={() => router.push("/collect")}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          testID="fabButton"
        >
          <Plus size={24} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.light.mutedText,
    marginTop: 2,
  },
  signOutBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(11, 18, 32, 0.05)",
  },
  signOutBtnPressed: {
    backgroundColor: "rgba(11, 18, 32, 0.1)",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.6,
  },
  sectionsWrap: {
    flex: 1,
  },

  doSection: {
    flex: 1,
    gap: 16,
  },

  pillRow: {
    flexDirection: "row" as const,
    gap: 8,
    paddingHorizontal: 24,
  },
  pill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(11, 18, 32, 0.05)",
  },
  pillActive: {
    backgroundColor: Colors.light.text,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "rgba(11, 18, 32, 0.5)",
  },
  pillTextActive: {
    color: "#fff",
  },
  doEmptyState: {
    alignItems: "center" as const,
    paddingVertical: 48,
    paddingHorizontal: 40,
    gap: 12,
  },
  doEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(11, 18, 32, 0.04)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },
  doEmptyText: {
    fontSize: 14,
    color: "rgba(11, 18, 32, 0.4)",
    textAlign: "center" as const,
  },
  doEmptyAction: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(28, 93, 153, 0.08)",
    marginTop: 8,
  },
  doEmptyActionText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.light.tint,
  },

  doList: {
    gap: 2,
  },
  doCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 10,
    paddingHorizontal: 24,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  doCardThumbContainer: {
    width: 48,
    height: 48,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  doCardThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F0F0EE",
    overflow: "hidden" as const,
    transform: [{ rotate: "-3deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  doCardImage: {
    width: "100%",
    height: "100%",
  },
  doCardPlaceholder: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  doCardContent: {
    flex: 1,
    gap: 2,
  },
  doCardTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  doCardMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  doCardLocation: {
    fontSize: 13,
    color: Colors.light.mutedText,
    flex: 1,
  },
  doCardTime: {
    fontSize: 12,
    color: "rgba(11, 18, 32, 0.4)",
  },
  doCardAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(28, 93, 153, 0.08)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  doCardActionPressed: {
    backgroundColor: "rgba(28, 93, 153, 0.15)",
  },

  emptyState: {
    alignItems: "center" as const,
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(28, 93, 153, 0.08)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.mutedText,
    textAlign: "center" as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.light.mutedText,
  },
  fab: {
    position: "absolute" as const,
    alignSelf: "center" as const,
    left: "50%" as const,
    marginLeft: -28,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.text,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
  },
  mapViewContainer: {
    flex: 1,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden" as const,
    backgroundColor: "#E8E8E6",
    minHeight: 320,
  },
  mapView: {
    flex: 1,
    minHeight: 320,
  },
  mapEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(250, 250, 248, 0.85)",
  },
  mapEmptyCard: {
    alignItems: "center" as const,
    gap: 8,
    padding: 24,
  },
  mapEmptyText: {
    fontSize: 14,
    color: "rgba(11, 18, 32, 0.4)",
  },
  webMapFallback: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 32,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(11, 18, 32, 0.06)",
  },
  webMapFallbackTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginTop: 8,
  },
  webMapFallbackText: {
    fontSize: 13,
    color: "rgba(11, 18, 32, 0.5)",
  },
  webMapList: {
    flex: 1,
  },
  webMapListContent: {
    padding: 16,
    gap: 8,
  },
  webMapItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  webMapItemContent: {
    flex: 1,
    gap: 2,
  },
  webMapItemTitle: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.light.text,
  },
  webMapItemLocation: {
    fontSize: 12,
    color: "rgba(11, 18, 32, 0.5)",
  },
  emojiMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  emojiText: {
    fontSize: 18,
  },
});
