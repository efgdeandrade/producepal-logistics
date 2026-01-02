// Audio notification utility for FnB picker stations

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

// Generate a pleasant chime sound using Web Audio API
export const playOrderNotificationSound = async (): Promise<void> => {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    
    // Create a pleasant two-tone chime
    const frequencies = [523.25, 659.25]; // C5 and E5
    
    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now);
      
      // Envelope: quick attack, medium decay
      gainNode.gain.setValueAtTime(0, now + (index * 0.15));
      gainNode.gain.linearRampToValueAtTime(0.3, now + (index * 0.15) + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + (index * 0.15) + 0.5);
      
      oscillator.start(now + (index * 0.15));
      oscillator.stop(now + (index * 0.15) + 0.5);
    });
  } catch (error) {
    console.log('Audio notification not available:', error);
  }
};

// Play an urgent notification sound (for high priority orders)
export const playUrgentNotificationSound = async (): Promise<void> => {
  try {
    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    
    // Three quick ascending beeps for urgency
    const frequencies = [440, 554.37, 659.25]; // A4, C#5, E5
    
    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(freq, now);
      
      gainNode.gain.setValueAtTime(0, now + (index * 0.1));
      gainNode.gain.linearRampToValueAtTime(0.2, now + (index * 0.1) + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + (index * 0.1) + 0.15);
      
      oscillator.start(now + (index * 0.1));
      oscillator.stop(now + (index * 0.1) + 0.15);
    });
  } catch (error) {
    console.log('Audio notification not available:', error);
  }
};
