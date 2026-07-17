export type NotificationSound = "success" | "error" | "info" | "mail";

let audioContext: AudioContext | null = null;

export function primeNotificationSound() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
  } catch {
    // Audio is optional and may be unavailable in restricted browser contexts.
  }
}

export function playNotificationSound(kind: NotificationSound) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext ??= new AudioContextClass();
    const context = audioContext;
    const play = () => {
      const now = context.currentTime;
      const notes = soundNotes(kind);
      notes.forEach(({ frequency, delay, duration }, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = index ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, now + delay);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(kind === "error" ? 0.024 : 0.018, now + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.02);
      });
    };

    if (context.state === "suspended") void context.resume().then(play).catch(() => undefined);
    else play();
  } catch {
    // Browsers can block audio until the first user interaction.
  }
}

function soundNotes(kind: NotificationSound) {
  if (kind === "mail") return [
    { frequency: 660, delay: 0, duration: 0.12 },
    { frequency: 880, delay: 0.1, duration: 0.18 }
  ];
  if (kind === "success") return [
    { frequency: 523, delay: 0, duration: 0.1 },
    { frequency: 659, delay: 0.08, duration: 0.14 }
  ];
  if (kind === "error") return [
    { frequency: 330, delay: 0, duration: 0.12 },
    { frequency: 262, delay: 0.09, duration: 0.18 }
  ];
  return [{ frequency: 587, delay: 0, duration: 0.13 }];
}
