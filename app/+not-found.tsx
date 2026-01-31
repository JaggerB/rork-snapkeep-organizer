import Colors from "@/constants/colors";
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container} testID="notFoundScreen">
        <Text style={styles.title}>That page is gone.</Text>
        <Text style={styles.body}>
          If you got here from a link, try going back to your library.
        </Text>

        <Link href="/" style={styles.link} testID="notFoundGoHome">
          <Text style={styles.linkText}>Back to Library</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.light.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.mutedText,
  },
  link: {
    marginTop: 10,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },
});
