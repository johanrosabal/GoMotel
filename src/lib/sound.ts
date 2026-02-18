'use client';

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window !== 'undefined' && !audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("AudioContext is not supported.", e);
    }
  }
  return audioContext;
};

export const playNotificationSound = () => {
  const context = getAudioContext();
  if (!context) {
    console.warn('AudioContext is not supported by this browser.');
    return;
  }
  
  // AudioContext must be resumed (or created) by a user gesture.
  // We'll try to resume it here. If it fails, subsequent attempts might work
  // if the user has interacted with the page.
  if (context.state === 'suspended') {
    context.resume();
  }

  try {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, context.currentTime); // E5 note
    gainNode.gain.setValueAtTime(0.3, context.currentTime);

    oscillator.start(context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
    oscillator.stop(context.currentTime + 0.5);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};
