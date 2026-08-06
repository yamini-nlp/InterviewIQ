let unlocked = false;

export function unlockSpeechSynthesis(): void {
  if (unlocked) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.cancel();
    unlocked = true;
  } catch {
  }
}

export function isSpeechSynthesisUnlocked(): boolean {
  return unlocked;
}