// Trusted Rider sign-out (BEN-29). Order matters: the server calls need the token, so they run
// first (each best effort with a short timeout, so signing out offline still works), then the
// device is wiped.
//
//   1. stop the background location task (the phone stops reporting its position)
//   2. DELETE /api/push_tokens for this device (the next TR on a shared phone gets no old pushes)
//   3. POST /api/logout (the server revokes the token)
//   4. delete the token from the secure store and every "trustedriders-*" key from AsyncStorage
//      (ride detail cache, active ride, ride snapshot, name, email)
//   5. drop passenger photos from expo-image's memory cache (they are never written to disk)
//   6. forget the Face ID / Touch ID sign-in (lib/biometric-sign-in.ts), unless the session only expired:
//      then the same TR signs back in with Face ID

import { biometricSignInEmail, markBiometricSignIn, removeBiometricSignIn } from "./biometric-sign-in";
import { clearToken, logoutFromServer } from "./fleet-api";
import { stopBackgroundLocationUpdates } from "./location-context";
import { clearPassengerPhotoCache } from "./passenger-photo";
import { unregisterPushToken } from "./push-notifications";
import { clearAllAppStorage } from "./session-cache";

export async function signOutDriver({ keepBiometricSignIn = false } = {}): Promise<void> {
  // Read before the wipe below removes its "trustedriders-*" marker.
  const biometricEmail = keepBiometricSignIn ? await biometricSignInEmail() : null;
  await stopBackgroundLocationUpdates();
  await Promise.all([unregisterPushToken(), logoutFromServer()]);
  await clearToken();
  await clearAllAppStorage();
  await clearPassengerPhotoCache();
  if (biometricEmail) await markBiometricSignIn(biometricEmail);
  else await removeBiometricSignIn();
}
