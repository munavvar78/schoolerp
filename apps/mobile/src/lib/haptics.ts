import * as Haptics from 'expo-haptics';

export async function hapticTap(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Some devices and simulators do not expose haptics.
  }
}

export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Some devices and simulators do not expose haptics.
  }
}
