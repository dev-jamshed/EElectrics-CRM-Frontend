export type NotificationSettings = {
  emailReplies: boolean;
  payments: boolean;
  bookings: boolean;
};

export const notificationSettingsKey = "modern-crm-notification-settings";

export const defaultNotificationSettings: NotificationSettings = {
  emailReplies: true,
  payments: true,
  bookings: true
};

export function readNotificationSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(notificationSettingsKey);
    if (!stored) return defaultNotificationSettings;
    return { ...defaultNotificationSettings, ...JSON.parse(stored) };
  } catch {
    return defaultNotificationSettings;
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  localStorage.setItem(notificationSettingsKey, JSON.stringify(settings));
}
