'use client';

let audioContext: AudioContext | null = null;
let isAudioContextInitialized = false;

// Function to initialize or resume the AudioContext.
// This must be called from within a user gesture handler (e.g., a click event).
export const initializeAudio = () => {
  if (typeof window === 'undefined' || isAudioContextInitialized) {
    return;
  }

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // If the context is in a suspended state, it needs to be resumed.
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        isAudioContextInitialized = true;
      });
    } else {
      isAudioContextInitialized = true;
    }
  } catch (e) {
    console.error("AudioContext could not be created or resumed.", e);
  }
};

const getAudioContext = () => {
  // This is a fallback in case initialization was missed.
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
    console.warn('AudioContext is not available.');
    return;
  }
  
  // If it's still suspended, it means it was never initialized by a user gesture.
  if (context.state !== 'running') {
    console.warn('AudioContext is suspended. Sound was blocked by the browser. Requires user interaction to enable audio.');
    return;
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
