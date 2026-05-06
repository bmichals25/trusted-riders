import type { BarcodeScanningResult } from "expo-camera";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type ScanResult = {
  data: string;
  type: string;
  scannedAt: string;
};

type CameraPermissionState = {
  granted: boolean;
  canAskAgain?: boolean;
};

type CameraModule = {
  CameraView: ComponentType<any> & {
    isAvailableAsync?: () => Promise<boolean>;
  };
  getCameraPermissionsAsync?: () => Promise<CameraPermissionState>;
  requestCameraPermissionsAsync?: () => Promise<CameraPermissionState>;
};

export default function ScanQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cameraModule, setCameraModule] = useState<CameraModule | null>(null);
  const [permission, setPermission] = useState<CameraPermissionState | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const scanLocked = useRef(false);
  const { impact, notification } = useHaptics();

  useEffect(() => {
    let mounted = true;

    async function prepareCamera() {
      try {
        // Load at runtime so simulator builds without ExpoCamera don't crash
        // before we can show a graceful unavailable state.
        const loadedCamera = require("expo-camera") as CameraModule;
        const available = loadedCamera.CameraView.isAvailableAsync
          ? await loadedCamera.CameraView.isAvailableAsync()
          : true;
        const currentPermission = loadedCamera.getCameraPermissionsAsync
          ? await loadedCamera.getCameraPermissionsAsync()
          : { granted: false, canAskAgain: true };

        if (!mounted) return;
        setCameraModule(loadedCamera);
        setCameraAvailable(available);
        setPermission(currentPermission);
      } catch {
        if (!mounted) return;
        setCameraModule(null);
        setCameraAvailable(false);
        setPermission({ granted: true, canAskAgain: false });
        setCameraError("Camera scanner is not available in this simulator build.");
      }
    }

    prepareCamera();
    return () => {
      mounted = false;
    };
  }, []);

  const verificationUrl = useMemo(() => getOpenableUrl(scanResult?.data), [scanResult?.data]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanLocked.current) return;
      const data = result.data.trim();
      if (!data) return;

      scanLocked.current = true;
      notification(NotificationFeedbackType.Success);
      setOpenError(null);
      setScanResult({
        data,
        type: result.type,
        scannedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
    },
    [notification],
  );

  const handleScanAgain = () => {
    impact(ImpactFeedbackStyle.Light);
    scanLocked.current = false;
    setOpenError(null);
    setScanResult(null);
  };

  const handleOpenUrl = async () => {
    if (!verificationUrl) return;
    impact(ImpactFeedbackStyle.Light);
    try {
      const canOpen = await Linking.canOpenURL(verificationUrl);
      if (!canOpen) {
        setOpenError("This QR code is not an openable verification URL.");
        return;
      }
      await Linking.openURL(verificationUrl);
    } catch {
      setOpenError("We could not open this verification URL.");
    }
  };

  if (!permission || cameraAvailable === null) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.centerText}>Preparing scanner...</Text>
      </View>
    );
  }

  if (!cameraModule || !cameraAvailable) {
    return (
      <View style={[styles.permissionScreen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.permissionCard}>
          <Text style={styles.kicker}>Scanner Unavailable</Text>
          <Text style={styles.permissionTitle}>Camera module missing</Text>
          <Text style={styles.permissionBody}>
            {cameraError || "The iOS Simulator usually cannot scan QR codes. Open this on a physical iPhone to test the scanner."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}
          >
            <Text style={styles.primaryButtonText}>Back to Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <View style={[styles.permissionScreen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.permissionCard}>
          <Text style={styles.kicker}>Driver Verification</Text>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            TrustedRiders uses the camera here only to scan another driver's verification QR code.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={blocked ? "Open settings for camera permission" : "Allow camera access"}
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              if (blocked) Linking.openSettings();
              else {
                cameraModule.requestCameraPermissionsAsync?.()
                  .then(setPermission)
                  .catch(() => setCameraError("We could not request camera permission."));
              }
            }}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}
          >
            <Text style={styles.primaryButtonText}>
              {blocked ? "Open Settings" : "Allow Camera"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            onPress={() => router.back()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const CameraView = cameraModule.CameraView;

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        active={!scanResult}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanResult ? undefined : handleBarcodeScanned}
        onMountError={(event: { message: string }) => setCameraError(event.message)}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeButton, pressed ? { opacity: 0.72 } : null]}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.topTitle}>Scan QR Code</Text>
          <Text style={styles.topSubtitle}>Point at another driver's verification QR.</Text>
        </View>
      </View>

      <View pointerEvents="none" style={styles.scanGuide}>
        <View style={styles.scanCornerTopLeft} />
        <View style={styles.scanCornerTopRight} />
        <View style={styles.scanCornerBottomLeft} />
        <View style={styles.scanCornerBottomRight} />
      </View>

      {cameraError ? (
        <View style={[styles.errorPill, { top: insets.top + 94 }]}>
          <Text style={styles.errorPillText}>{cameraError}</Text>
        </View>
      ) : null}

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 18 }]}>
        {scanResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultKicker}>QR captured</Text>
            <Text style={styles.resultTitle}>
              {verificationUrl ? "Verification URL found" : "QR payload found"}
            </Text>
            <Text selectable style={styles.resultData} numberOfLines={3}>
              {scanResult.data}
            </Text>
            <Text style={styles.resultMeta}>
              Type {scanResult.type.toUpperCase()} - {scanResult.scannedAt}
            </Text>
            {openError ? <Text style={styles.inlineError}>{openError}</Text> : null}
            <View style={styles.resultActions}>
              {verificationUrl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open verification URL"
                  onPress={handleOpenUrl}
                  style={({ pressed }) => [styles.resultPrimary, pressed ? styles.primaryButtonPressed : null]}
                >
                  <Text style={styles.resultPrimaryText}>Open URL</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scan another QR code"
                onPress={handleScanAgain}
                style={({ pressed }) => [styles.resultSecondary, pressed ? { opacity: 0.78 } : null]}
              >
                <Text style={styles.resultSecondaryText}>Scan Again</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.hintCard}>
            <Text style={styles.hintKicker}>Test flow</Text>
            <Text style={styles.hintText}>
              For now, the app reads the QR payload and can open the public verification URL. Once Suresh's endpoint is live, this screen can fetch and render the verified driver profile directly.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getOpenableUrl(data?: string): string | null {
  if (!data) return null;
  const trimmed = data.trim();
  if (/^https?:\/\//i.test(trimmed) || /^trustedriders:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: spacing.xl,
  },
  centerText: {
    color: colors.slate500,
    fontSize: 14,
    fontWeight: "700",
  },
  permissionScreen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: spacing.lg,
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.soft,
  },
  kicker: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  permissionTitle: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  permissionBody: {
    color: colors.slate500,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  primaryButtonPressed: {
    backgroundColor: "#1E293B",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  closeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(15, 23, 42, 0.64)",
  },
  closeText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  topCopy: {
    flex: 1,
    gap: 2,
  },
  topTitle: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  topSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    fontWeight: "700",
  },
  scanGuide: {
    position: "absolute",
    left: "15%",
    right: "15%",
    top: "32%",
    aspectRatio: 1,
  },
  scanCornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 54,
    height: 54,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: colors.accent,
    borderTopLeftRadius: radii.md,
  },
  scanCornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 54,
    height: 54,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: colors.accent,
    borderTopRightRadius: radii.md,
  },
  scanCornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 54,
    height: 54,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: colors.accent,
    borderBottomLeftRadius: radii.md,
  },
  scanCornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 54,
    height: 54,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: colors.accent,
    borderBottomRightRadius: radii.md,
  },
  errorPill: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorPillText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
  },
  hintCard: {
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: 8,
  },
  hintKicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  hintText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.soft,
  },
  resultKicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  resultTitle: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  resultData: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    paddingVertical: 6,
  },
  resultMeta: {
    color: colors.slate400,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  inlineError: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "700",
  },
  resultActions: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  resultPrimary: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  resultPrimaryText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  resultSecondary: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  resultSecondaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
