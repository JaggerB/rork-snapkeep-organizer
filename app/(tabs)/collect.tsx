import { extractDetailsFromScreenshot } from "@/lib/ai/extract-screenshot";
import { lookupLocationCoordinates, generateGoogleMapsUrl } from "@/lib/ai/lookup-location";
import { createId, SavedItem, useSavedItems, Coordinates } from "@/providers/saved-items";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useFocusEffect } from "expo-router";
import { ImagePlus, X } from "lucide-react-native";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Draft = {
  imageUri: string | null;
  imageDataUrl: string | null;
  title: string;
  dateTimeISO: string;
  location: string;
  coordinates: Coordinates | null;
  mapsUrl: string | null;
  category: string;
  source: string;
  notes: string;
};

function normalizeCategory(input: string): string {
  const v = input.trim();
  if (!v) return "Other";
  const lower = v.toLowerCase();
  if (lower.includes("date")) return "Date night";
  if (lower.includes("event")) return "Events";
  if (lower.includes("travel") || lower.includes("trip")) return "Travel";
  if (lower.includes("hike") || lower.includes("trail")) return "Hikes";
  if (lower.includes("food") || lower.includes("restaurant")) return "Food";
  if (lower.includes("shop") || lower.includes("store")) return "Shopping";
  if (lower.includes("movie") || lower.includes("film")) return "Movies";
  return v;
}

const { width } = Dimensions.get("window");
const IMAGE_SIZE = width * 0.65;

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnimation(dot1, 0);
    const anim2 = createAnimation(dot2, 150);
    const anim3 = createAnimation(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const getAnimatedStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.2],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, getAnimatedStyle(dot1)]} />
      <Animated.View style={[styles.dot, getAnimatedStyle(dot2)]} />
      <Animated.View style={[styles.dot, getAnimatedStyle(dot3)]} />
    </View>
  );
}

export default function CollectScreen() {
  const { addItem } = useSavedItems();
  const [isExtracting, setIsExtracting] = useState(false);

  const [draft, setDraft] = useState<Draft>({
    imageUri: null,
    imageDataUrl: null,
    title: "",
    dateTimeISO: "",
    location: "",
    coordinates: null,
    mapsUrl: null,
    category: "",
    source: "",
    notes: "",
  });

  const hasImage = !!draft.imageUri;

  useFocusEffect(
    useCallback(() => {
      setDraft({
        imageUri: null,
        imageDataUrl: null,
        title: "",
        dateTimeISO: "",
        location: "",
        coordinates: null,
        mapsUrl: null,
        category: "",
        source: "",
        notes: "",
      });
      setIsExtracting(false);
    }, [])
  );

  const clear = useCallback(() => {
    setDraft({
      imageUri: null,
      imageDataUrl: null,
      title: "",
      dateTimeISO: "",
      location: "",
      coordinates: null,
      mapsUrl: null,
      category: "",
      source: "",
      notes: "",
    });
  }, []);

  const saveItem = useCallback(async (extractedDraft: Draft) => {
    if (!extractedDraft.title.trim()) {
      console.log("[CollectScreen] saveItem aborted: no title");
      return;
    }
    if (!extractedDraft.imageUri && !extractedDraft.imageDataUrl) {
      console.log("[CollectScreen] saveItem aborted: no image");
      return;
    }

    const imageToSave = extractedDraft.imageDataUrl || extractedDraft.imageUri;
    console.log("[CollectScreen] imageToSave type:", imageToSave?.substring(0, 30));
    console.log("[CollectScreen] imageDataUrl exists:", !!extractedDraft.imageDataUrl);
    console.log("[CollectScreen] imageUri exists:", !!extractedDraft.imageUri);

    const item: SavedItem = {
      id: createId(),
      createdAt: new Date().toISOString(),
      title: extractedDraft.title.trim(),
      dateTimeISO: extractedDraft.dateTimeISO.trim() || null,
      location: extractedDraft.location.trim() || null,
      coordinates: extractedDraft.coordinates,
      mapsUrl: extractedDraft.mapsUrl,
      category: normalizeCategory(extractedDraft.category),
      source: extractedDraft.source.trim() || null,
      imageUri: imageToSave,
      notes: extractedDraft.notes.trim() || null,
    };

    console.log("[CollectScreen] saving item with imageUri length:", item.imageUri?.length);
    addItem(item);

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    router.replace("/");
  }, [addItem]);

  const pickScreenshot = useCallback(async () => {
    console.log("[CollectScreen] pickScreenshot");

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      base64: true,
      selectionLimit: 1,
      exif: false,
    });

    if (res.canceled) return;

    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    const dataUrl = asset.base64
      ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
      : null;

    setDraft({
      imageUri: asset.uri,
      imageDataUrl: dataUrl,
      title: "",
      dateTimeISO: "",
      location: "",
      coordinates: null,
      mapsUrl: null,
      category: "",
      source: "",
      notes: "",
    });

    try {
      await Haptics.selectionAsync();
    } catch {}

    if (dataUrl) {
      setIsExtracting(true);
      try {
        const data = await extractDetailsFromScreenshot({ imageDataUrl: dataUrl });
        console.log("[CollectScreen] extract success", data);
        
        let coordinates: Coordinates | null = null;
        let mapsUrl: string | null = null;
        
        const locationToLookup = data.location || data.title;
        if (locationToLookup) {
          console.log("[CollectScreen] looking up location:", locationToLookup);
          console.log("[CollectScreen] address details:", {
            street: data.streetAddress,
            neighborhood: data.neighborhood,
            city: data.city,
            state: data.state,
            country: data.country,
          });
          try {
            const locationResult = await lookupLocationCoordinates({
              locationName: locationToLookup,
              title: data.title,
              context: data.category ?? undefined,
              streetAddress: data.streetAddress,
              neighborhood: data.neighborhood,
              city: data.city,
              state: data.state,
              country: data.country,
            });
            
            if (locationResult.latitude && locationResult.longitude) {
              coordinates = {
                latitude: locationResult.latitude,
                longitude: locationResult.longitude,
              };
              mapsUrl = generateGoogleMapsUrl({
                latitude: locationResult.latitude,
                longitude: locationResult.longitude,
                query: data.location || data.title,
              });
              console.log("[CollectScreen] location found:", coordinates, mapsUrl);
            }
          } catch (locErr) {
            console.warn("[CollectScreen] location lookup failed:", locErr);
          }
        }
        
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        const finalDraft: Draft = {
          imageUri: asset.uri,
          imageDataUrl: dataUrl,
          title: data.title ?? "",
          dateTimeISO: data.dateTimeISO ?? "",
          location: data.location ?? "",
          coordinates,
          mapsUrl,
          category: data.category ?? "",
          source: data.source ?? "",
          notes: data.notes ?? "",
        };
        
        setDraft(finalDraft);
        setIsExtracting(false);
        
        await saveItem(finalDraft);
      } catch (err) {
        console.error("[CollectScreen] extract error", err);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsExtracting(false);
        Alert.alert("Couldn't extract details", "Please try again.");
        clear();
      }
    }
  }, [saveItem, clear]);

  return (
    <View style={styles.root} testID="collectScreen">
      <Stack.Screen
        options={{
          title: "",
          headerShown: false,
        }}
      />

      <View style={styles.closeRow}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} testID="closeBtn">
          <X size={20} color="#666" />
        </Pressable>
      </View>

      <View style={styles.centerContent}>
        {hasImage ? (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: draft.imageUri ?? undefined }}
              style={styles.previewImage}
              contentFit="cover"
            />
          </View>
        ) : (
          <Pressable onPress={pickScreenshot} style={styles.addBtn} testID="pickBtn">
            <ImagePlus size={32} color="#999" />
            <Text style={styles.addBtnText}>Add screenshot</Text>
          </Pressable>
        )}

        {isExtracting && (
          <View style={styles.analyzingBox}>
            <LoadingDots />
            <Text style={styles.analyzingText}>Analyzing...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F3F0",
  },
  closeRow: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  centerContent: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 40,
    gap: 40,
  },
  addBtn: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: "#999",
  },
  imageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 24,
    overflow: "hidden" as const,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  analyzingBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: "center" as const,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  dotsContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1a1a1a",
  },
  analyzingText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#666",
    letterSpacing: 0.3,
  },
});
