import Colors from "@/constants/colors";
import { useAuth } from "@/providers/auth";
import { router, Stack } from "expo-router";
import { X } from "lucide-react-native";
import React, { useState, useEffect } from "react";
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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile, signOut, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const n = user?.user_metadata?.name;
    if (n) setName(n);
    else if (user?.email) setName(user.email.split("@")[0]);
  }, [user]);

  const handleSave = async () => {
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    clearError();
    const success = await updateProfile({ name: name.trim() });
    setSubmitting(false);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.replace("/sign-in");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          title: "Settings",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.background },
          headerRight: () => (
            <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.light.mutedText}
                value={name}
                onChangeText={(text) => {
                  clearError();
                  setName(text);
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleSave}
              disabled={submitting || !name.trim()}
              style={({ pressed }) => [
                styles.saveBtn,
                (submitting || !name.trim()) && styles.saveBtnDisabled,
                pressed && styles.saveBtnPressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save changes"}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue}>{user?.email || "—"}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
          >
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  flex: {
    flex: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 18, 32, 0.05)",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.mutedText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: "rgba(60, 60, 67, 0.12)",
  },
  errorBox: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
  },
  saveBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnPressed: {
    opacity: 0.9,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  accountRow: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(60, 60, 67, 0.12)",
  },
  accountLabel: {
    fontSize: 13,
    color: Colors.light.mutedText,
    marginBottom: 4,
  },
  accountValue: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.text,
  },
  signOutBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutBtnPressed: {
    opacity: 0.7,
  },
  signOutBtnText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FF3B30",
  },
});
