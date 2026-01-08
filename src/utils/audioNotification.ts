/**
 * Audio notification utilities for FnB picker stations
 * Handles browser autoplay policies and provides notification sounds
 */

let audioContext: AudioContext | null = null;
let userHasInteracted = false;

// Set up global interaction listener to enable audio
if (typeof window !== 'undefined') {
  const enableAudio = () => {
    userHasInteracted = true;
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  };
  
  // Listen for any user interaction
  ['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, enableAudio, { once: false, passive: true });
  });
}

/**
 * Gets or creates the AudioContext, handling browser autoplay policies
 */
export const getAudioContext = async (): Promise<AudioContext | null> => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
      if (userHasInteracted) {
        await audioContext.resume();
      } else {
        console.log('[AudioNotification] AudioContext suspended, waiting for user interaction');
        return null;
      }
    }
    
    return audioContext;
  } catch (error) {
    console.error('[AudioNotification] Error creating AudioContext:', error);
    return null;
  }
};

/**
 * Plays a pleasant two-tone chime for new orders
 */
export const playOrderNotificationSound = async (): Promise<void> => {
  const ctx = await getAudioContext();
  if (!ctx) {
    console.log('[AudioNotification] Cannot play sound - no AudioContext available');
    return;
  }

  try {
    const now = ctx.currentTime;
    
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (slightly delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1108.73, now + 0.15); // C#6
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.45);
    
    console.log('[AudioNotification] Order notification sound played');
  } catch (error) {
    console.error('[AudioNotification] Error playing order sound:', error);
  }
};

/**
 * Plays urgent notification beeps for priority orders
 */
export const playUrgentNotificationSound = async (): Promise<void> => {
  const ctx = await getAudioContext();
  if (!ctx) {
    console.log('[AudioNotification] Cannot play sound - no AudioContext available');
    return;
  }

  try {
    const now = ctx.currentTime;
    const frequencies = [440, 554.37, 659.25]; // A4, C#5, E5
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.08);
    });
    
    console.log('[AudioNotification] Urgent notification sound played');
  } catch (error) {
    console.error('[AudioNotification] Error playing urgent sound:', error);
  }
};
