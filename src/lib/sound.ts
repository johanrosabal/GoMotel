'use client';

// Sound type should be exported to be used in the settings component
export type AlarmSound = 'bip' | 'bell' | 'digital';
const ALARM_SOUND_KEY = 'alarm_sound_preference';


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

// --- Specific Sound Implementations ---

const playBip = (context: AudioContext) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, context.currentTime); // A5 note (sharper)
    gainNode.gain.setValueAtTime(1.0, context.currentTime);

    oscillator.start(context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.001, context.currentTime + 0.4);
    oscillator.stop(context.currentTime + 0.4);
};

const playBell = (context: AudioContext) => {
    const oscillator1 = context.createOscillator();
    const oscillator2 = context.createOscillator();
    const gainNode = context.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator1.type = 'square';
    oscillator2.type = 'square';

    oscillator1.frequency.setValueAtTime(960, context.currentTime);
    oscillator2.frequency.setValueAtTime(480, context.currentTime);

    gainNode.gain.setValueAtTime(1.0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.001, context.currentTime + 1.2);

    oscillator1.start(context.currentTime);
    oscillator2.start(context.currentTime);
    oscillator1.stop(context.currentTime + 1.5);
    oscillator2.stop(context.currentTime + 1.5);
};

const playDigitalAlarm = (context: AudioContext) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(1.0, context.currentTime);

    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1046.5, context.currentTime + 0.1);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);
};


// --- Main player function ---

export const playNotificationSound = async (forceSound?: AlarmSound) => {
  const context = getAudioContext();
  if (!context) {
    return;
  }
  
  // If the context is suspended, try to resume it and wait for it.
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (err) {
      console.warn('Could not resume audio context:', err);
    }
  }

  // Double check state before playing
  if (context.state !== 'running') {
    return;
  }
  
  const soundToPlay = forceSound || localStorage.getItem(ALARM_SOUND_KEY) as AlarmSound | null || 'bip';

  try {
    switch (soundToPlay) {
        case 'bip':
            playBip(context);
            break;
        case 'bell':
            playBell(context);
            break;
        case 'digital':
            playDigitalAlarm(context);
            break;
        default:
            playBip(context); // Fallback to bip
            break;
    }
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};
