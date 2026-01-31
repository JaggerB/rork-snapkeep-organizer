import Colors from "@/constants/colors";
import { SavedItem, useSavedItems } from "@/providers/saved-items";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { MapPin, Navigation, X } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

function ItemCard({
  item,
  onClose,
  onDirections,
}: {
  item: SavedItem;
  onClose: () => void;
  onDirections: () => void;
}) {
  return (
    <Animated.View style={styles.card}>
      <Pressable style={styles.cardClose} onPress={onClose} testID="mapCardClose">
        <X size={16} color="#666" />
      </Pressable>

      <Pressable
        style={styles.cardContent}
        onPress={() => router.push({ pathname: "/modal", params: { id: item.id } })}
        testID={`mapCard_${item.id}`}
      >
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <MapPin size={24} color="rgba(11, 18, 32, 0.2)" />
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.location && (
            <View style={styles.cardLocation}>
              <MapPin size={12} color={Colors.light.mutedText} />
              <Text style={styles.cardLocationText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          )}
          <View style={styles.cardCategory}>
            <Text style={styles.cardCategoryText}>{item.category}</Text>
          </View>
        </View>
      </Pressable>

      <Pressable style={styles.directionsBtn} onPress={onDirections} testID="mapCardDirections">
        <Navigation size={14} color="#fff" />
        <Text style={styles.directionsBtnText}>Directions</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function MapScreen() {
  const { items } = useSavedItems();
  const mapRef = useRef<MapView>(null);
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);

  const itemsWithLocation = useMemo(
    () => items.filter((item) => item.coordinates?.latitude && item.coordinates?.longitude),
    [items]
  );

  const initialRegion = useMemo(() => {
    if (itemsWithLocation.length === 0) return DEFAULT_REGION;

    const lats = itemsWithLocation.map((i) => i.coordinates!.latitude);
    const lngs = itemsWithLocation.map((i) => i.coordinates!.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const latDelta = Math.max(0.02, (maxLat - minLat) * 1.5);
    const lngDelta = Math.max(0.02, (maxLng - minLng) * 1.5);

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [itemsWithLocation]);

  const handleMarkerPress = useCallback((item: SavedItem) => {
    console.log("[MapScreen] marker pressed:", item.title);
    setSelectedItem(item);

    if (item.coordinates) {
      mapRef.current?.animateToRegion(
        {
          latitude: item.coordinates.latitude,
          longitude: item.coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        300
      );
    }
  }, []);

  const handleDirections = useCallback(() => {
    if (!selectedItem?.coordinates) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedItem.coordinates.latitude},${selectedItem.coordinates.longitude}`;
    Linking.openURL(url);
  }, [selectedItem]);

  const closeCard = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <View style={styles.root} testID="mapScreen">
      <Stack.Screen options={{ title: "" }} />

      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>
          {itemsWithLocation.length} saved location{itemsWithLocation.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {itemsWithLocation.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MapPin size={32} color={Colors.light.mutedText} />
          </View>
          <Text style={styles.emptyTitle}>No locations yet</Text>
          <Text style={styles.emptyText}>
            Screenshots with places will appear on your map
          </Text>
        </View>
      ) : Platform.OS === "web" ? (
        <ScrollView style={styles.webList} contentContainerStyle={styles.webListContent}>
          {itemsWithLocation.map((item) => (
            <Pressable
              key={item.id}
              style={styles.webListItem}
              onPress={() => router.push({ pathname: "/modal", params: { id: item.id } })}
              testID={`webListItem_${item.id}`}
            >
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.webListImage} contentFit="cover" />
              ) : (
                <View style={[styles.webListImage, styles.webListImagePlaceholder]}>
                  <MapPin size={20} color="rgba(11, 18, 32, 0.2)" />
                </View>
              )}
              <View style={styles.webListInfo}>
                <Text style={styles.webListTitle} numberOfLines={2}>{item.title}</Text>
                {item.location && (
                  <View style={styles.webListLocation}>
                    <MapPin size={12} color={Colors.light.mutedText} />
                    <Text style={styles.webListLocationText} numberOfLines={1}>{item.location}</Text>
                  </View>
                )}
              </View>
              <Pressable
                style={styles.webDirectionsBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  if (item.coordinates) {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.coordinates.latitude},${item.coordinates.longitude}`);
                  }
                }}
              >
                <Navigation size={14} color={Colors.light.tint} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton
            testID="mapView"
          >
            {itemsWithLocation.map((item) => (
              <Marker
                key={item.id}
                coordinate={{
                  latitude: item.coordinates!.latitude,
                  longitude: item.coordinates!.longitude,
                }}
                title={item.title}
                description={item.location ?? undefined}
                onPress={() => handleMarkerPress(item)}
                pinColor={selectedItem?.id === item.id ? Colors.light.accent : Colors.light.tint}
                testID={`marker_${item.id}`}
              />
            ))}
          </MapView>

          {selectedItem && (
            <View style={styles.cardContainer}>
              <ItemCard
                item={selectedItem}
                onClose={closeCard}
                onDirections={handleDirections}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.mutedText,
    marginTop: 4,
  },
  mapWrapper: {
    flex: 1,
    position: "relative" as const,
  },
  map: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(11, 18, 32, 0.06)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.mutedText,
    textAlign: "center" as const,
  },
  cardContainer: {
    position: "absolute" as const,
    bottom: 24,
    left: 24,
    right: 24,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardClose: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cardContent: {
    flexDirection: "row" as const,
    gap: 12,
    marginBottom: 12,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "rgba(11, 18, 32, 0.04)",
  },
  cardImagePlaceholder: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
    paddingRight: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.light.text,
    lineHeight: 20,
  },
  cardLocation: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  cardLocationText: {
    fontSize: 13,
    color: Colors.light.mutedText,
    flex: 1,
  },
  cardCategory: {
    marginTop: 4,
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(28, 93, 153, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardCategoryText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.light.tint,
  },
  directionsBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 12,
  },
  directionsBtnText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#fff",
  },
  webList: {
    flex: 1,
  },
  webListContent: {
    padding: 16,
    gap: 12,
  },
  webListItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  webListImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "rgba(11, 18, 32, 0.04)",
  },
  webListImagePlaceholder: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  webListInfo: {
    flex: 1,
    gap: 4,
  },
  webListTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  webListLocation: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  webListLocationText: {
    fontSize: 13,
    color: Colors.light.mutedText,
    flex: 1,
  },
  webDirectionsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(28, 93, 153, 0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});
