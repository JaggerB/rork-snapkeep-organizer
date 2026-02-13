import Colors from "@/constants/colors";
import { useSavedItems } from "@/providers/saved-items";
import { extractScreenshotData } from "@/lib/ai/extract-screenshot-data";
import { lookupLocationCoordinates, fetchCoordinatesFromPlaceId } from "@/lib/ai/lookup-location";
import { verifyAndEnrichPlace } from "@/lib/ai/maps-grounding";
import { router, Stack, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { ImagePlus, X } from "lucide-react-native";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Alert,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

function mapCategory(cat: string | null): string {
  if (!cat) return "Other";
  const c = cat.toLowerCase();
  if (c === "event" || c.includes("concert") || c.includes("festival")) return "Events";
  if (c === "restaurant" || c === "cafe" || c === "bar") return "Food";
  if (c === "hotel" || c.includes("travel")) return "Travel";
  if (c === "hike" || c === "park" || c === "beach") return "Hikes";
  if (c === "shop") return "Shopping";
  if (c === "museum" || c === "attraction") return "Date night";
  return "Other";
}

export default function CollectScreen() {
  const insets = useSafeAreaInsets();
  const { addItem } = useSavedItems();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState("Analyzing...");
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  // Reset analysis state when screen gains focus so returning to add another screenshot starts fresh
  useFocusEffect(
    useCallback(() => {
      setImageUri(null);
      setIsAnalyzing(false);
      setStatusText("Analyzing...");
    }, [])
  );

  useEffect(() => {
    if (isAnalyzing) {
      const dotAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dotAnim, { toValue: 0, duration: 400, easing: Easing.ease, useNativeDriver: true }),
        ])
      );
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      dotAnimation.start();
      pulseAnimation.start();
      return () => { dotAnimation.stop(); pulseAnimation.stop(); };
    }
  }, [isAnalyzing]);

  const handlePickImage = useCallback(async () => {
    if (isAnalyzing) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please grant access to your photos to continue.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.4,
        base64: false,
      });
      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      setImageUri(uri);
      setIsAnalyzing(true);
      setStatusText("Reading screenshot...");

      try {
        const extractedData = await extractScreenshotData(uri);

        let imageBase64: string | null = null;
        const imageMimeType = uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        if (uri.startsWith("file://")) {
          try {
            imageBase64 = await readAsStringAsync(uri, { encoding: "base64" });
          } catch (e) {
            console.warn("Could not read image as base64:", e);
          }
        }

        let coordinates: { latitude: number; longitude: number } | undefined;
        let mapsUrl: string | undefined;
        const location = extractedData.location || null;
        const title = extractedData.title || null;

        setStatusText("Identifying place on Maps...");
        let enrichment: Awaited<ReturnType<typeof verifyAndEnrichPlace>> = {
          placeId: null, placeMapsUri: null, rating: null,
          openNow: null, openingHours: null, reviewSnippet: null,
          websiteUri: null, reservationUrl: null,
        };

        if (title || location || imageBase64) {
          try {
            enrichment = await verifyAndEnrichPlace(
              title || "",
              location,
              null,
              imageBase64,
              imageMimeType
            );
            if (enrichment.placeMapsUri) mapsUrl = enrichment.placeMapsUri;
            if (enrichment.placeId) {
              const placeCoords = await fetchCoordinatesFromPlaceId(enrichment.placeId);
              if (placeCoords.latitude && placeCoords.longitude) {
                coordinates = { latitude: placeCoords.latitude, longitude: placeCoords.longitude };
                if (placeCoords.mapsUrl) mapsUrl = placeCoords.mapsUrl;
              }
            }
          } catch (e) {
            console.warn("Maps verify failed:", e);
          }
        }

        if (!coordinates && (title || location)) {
          setStatusText("Finding location...");
          const tryLookup = async (searchQuery: string) => {
            const res = await lookupLocationCoordinates({ locationName: searchQuery.trim(), title: title || undefined });
            if (res?.latitude && res?.longitude) {
              return { latitude: res.latitude, longitude: res.longitude, mapsUrl: res.mapsUrl || undefined };
            }
            return null;
          };
          const queries = [
            [title, location].filter(Boolean).join(", "),
            location,
            title,
          ].filter((q): q is string => !!q && q.trim().length > 0);
          for (const q of queries) {
            const res = await tryLookup(q);
            if (res) {
              coordinates = { latitude: res.latitude, longitude: res.longitude };
              if (res.mapsUrl) mapsUrl = res.mapsUrl;
              break;
            }
          }
        }

        setStatusText("Saving...");
        const imageUriForSave = imageBase64 ? `data:image/${imageMimeType.replace("image/", "")};base64,${imageBase64}` : uri;

        const newItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          createdAt: new Date().toISOString(),
          title: extractedData.title || "New Place",
          imageUri: imageUriForSave,
          source: extractedData.source || undefined,
          category: mapCategory(extractedData.category) || "Other",
          location: extractedData.location || undefined,
          coordinates: coordinates || null,
          mapsUrl: mapsUrl || enrichment.placeMapsUri || undefined,
          dateTimeISO: extractedData.dateTimeISO || undefined,
          notes: extractedData.notes || extractedData.description || undefined,
          tripId: undefined,
          placeId: enrichment.placeId || undefined,
          placeMapsUri: enrichment.placeMapsUri || undefined,
          rating: enrichment.rating || undefined,
          openNow: enrichment.openNow ?? undefined,
          openingHours: enrichment.openingHours || undefined,
          reviewSnippet: enrichment.reviewSnippet || undefined,
          websiteUri: enrichment.websiteUri || undefined,
          reservationUrl: enrichment.reservationUrl || undefined,
          instagram: extractedData.instagram || undefined,
          tiktok: extractedData.tiktok || undefined,
        };
        await addItem(newItem);
        setImageUri(null);
        setIsAnalyzing(false);
        router.back();
      } catch (error) {
        console.error("Error processing screenshot:", error);
        Alert.alert("Error", "Failed to analyze screenshot. Please try again.");
        setImageUri(null);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  }, [addItem, isAnalyzing]);

  const handleCancel = useCallback(() => router.back(), []);

  const screenOptions = useMemo(() => ({ headerShown: false } as const), []);

  if (isAnalyzing && imageUri) {
    return (
      <View style={[styles.container, styles.analyzingContainer]}>
        <Stack.Screen options={screenOptions} />
        <Pressable onPress={handleCancel} style={[styles.closeBtn, { top: insets.top + 12 }]}>
          <X size={22} color={Colors.light.mutedText} />
        </Pressable>
        <View style={styles.analyzingContent}>
          <Animated.View style={[styles.analyzingImageContainer, { transform: [{ scale: pulseAnim }] }]}>
            <Image source={{ uri: imageUri }} style={styles.analyzingImage} contentFit="cover" />
          </Animated.View>
          <View style={styles.statusContainer}>
            <View style={styles.dotsContainer}>
              <Animated.View style={[styles.dot, { opacity: dotAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }) }]} />
              <Animated.View style={[styles.dot, { opacity: dotAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 1] }) }]} />
              <Animated.View style={[styles.dot, { opacity: dotAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 0.3] }) }]} />
            </View>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={screenOptions} />
      <Pressable onPress={handleCancel} style={[styles.closeBtn, { top: insets.top + 12 }]}>
        <X size={22} color={Colors.light.mutedText} />
      </Pressable>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Pressable onPress={handlePickImage} style={({ pressed }) => [styles.addCard, pressed && styles.addCardPressed]}>
          <View style={styles.addCardInner}>
            <ImagePlus size={32} color="#6366F1" strokeWidth={1.5} />
            <Text style={styles.addCardText}>Add screenshot</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  analyzingContainer: { backgroundColor: Colors.light.background },
  closeBtn: { position: "absolute", left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", zIndex: 10 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  addCard: { width: "100%", aspectRatio: 1, maxWidth: 280, maxHeight: 280, backgroundColor: "#fff", borderRadius: 24, borderWidth: 2, borderColor: "#6366F1", borderStyle: "dashed", shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  addCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  addCardInner: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  addCardText: { fontSize: 17, fontWeight: "500", color: Colors.light.mutedText },
  analyzingContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  analyzingImageContainer: { width: 200, height: 200, borderRadius: 20, overflow: "hidden", backgroundColor: "#F2F2F7", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  analyzingImage: { width: "100%", height: "100%" },
  statusContainer: { marginTop: 32, alignItems: "center", backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  dotsContainer: { flexDirection: "row", gap: 6, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366F1" },
  statusText: { fontSize: 15, fontWeight: "500", color: Colors.light.text },
});
