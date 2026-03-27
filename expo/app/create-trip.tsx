import Colors from "@/constants/colors";
import { useTrips } from "@/providers/trips";
import { router, Stack } from "expo-router";
import { Calendar, X } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function CreateTripScreen() {
  const { addTrip } = useTrips();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a name for your trip");
      return;
    }

    setIsSubmitting(true);
    try {
      const trip = await addTrip({
        name: name.trim(),
        description: description.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      if (trip) {
        router.back();
      } else {
        Alert.alert("Error", "Failed to create trip. Please try again.");
      }
    } catch (e) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "New Trip",
          headerShown: true,
          presentation: "modal",
          headerStyle: { backgroundColor: Colors.light.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <X size={20} color={Colors.light.text} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trip Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tokyo Adventure, Weekend in Sydney"
                placeholderTextColor={Colors.light.mutedText}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What's this trip about?"
                placeholderTextColor={Colors.light.mutedText}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.light.mutedText}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>End Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.light.mutedText}
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            <View style={styles.dateHint}>
              <Calendar size={14} color={Colors.light.mutedText} />
              <Text style={styles.dateHintText}>
                Dates are optional and help organize your trips
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.createButtonPressed,
              isSubmitting && styles.createButtonDisabled,
            ]}
          >
            <Text style={styles.createButtonText}>
              {isSubmitting ? "Creating..." : "Create Trip"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  form: {
    gap: 24,
    marginBottom: 40,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.mutedText,
    marginLeft: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row" as const,
    gap: 12,
  },
  dateHint: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: -8,
  },
  dateHintText: {
    fontSize: 13,
    color: Colors.light.mutedText,
  },
  createButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: Colors.light.tint,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  createButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
});
