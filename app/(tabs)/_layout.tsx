import Colors from "@/constants/colors";
import { Tabs } from "expo-router";
import { Bookmark, Map, Sparkles } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: "rgba(11, 18, 32, 0.45)",
        tabBarStyle: {
          display: "none",
        },
        headerStyle: {
          backgroundColor: Colors.light.background,
        },
        headerTitleStyle: {
          fontWeight: "800",
        },
        headerShadowVisible: Platform.OS !== "web",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Library",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Bookmark color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="collect"
        options={{
          title: "Collect",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Sparkles color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Map color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
