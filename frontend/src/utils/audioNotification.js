/**
 * Audio Notification Service using Web Audio API
 * Generates instant, pleasant, zero-latency chimes for:
 * - Check In (Bright ascending harmonic chime)
 * - Check Out (Smooth resonant descending chime)
 * - Error (Subtle double-tone warning)
 * No external media files or network requests required.
 */

class SoundController {
    constructor() {
        this.ctx = null;
    }

    getAudioContext() {
        try {
            if (!this.ctx || this.ctx.state === 'closed') {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return this.ctx;
        } catch (e) {
            console.warn('Could not initialize AudioContext:', e);
            return null;
        }
    }

    /**
     * Check-in sound: Upbeat, harmonic ascending two-tone kiosk chime (E5 -> A5)
     */
    playCheckIn() {
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            // Tone 1: E5 (659.25 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, now);
            gain1.gain.setValueAtTime(0.001, now);
            gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.18);

            // Tone 2: A5 (880 Hz) - crisp, bright finish
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, now + 0.12);
            gain2.gain.setValueAtTime(0.001, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.32, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.55);
        } catch (e) {
            console.warn('Audio check-in playback failed:', e);
        }
    }

    /**
     * Check-out sound: Smooth, distinct descending two-tone chime (G5 -> C5)
     */
    playCheckOut() {
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            // Tone 1: G5 (783.99 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(783.99, now);
            gain1.gain.setValueAtTime(0.001, now);
            gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.18);

            // Tone 2: C5 (523.25 Hz) - warm, resonant checkout resolution
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(523.25, now + 0.12);
            gain2.gain.setValueAtTime(0.001, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.6);
        } catch (e) {
            console.warn('Audio check-out playback failed:', e);
        }
    }

    /**
     * Error / Invalid scan sound: Low dual warning tone
     */
    playError() {
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(180, now + 0.1);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.28);
        } catch (e) {
            console.warn('Audio error playback failed:', e);
        }
    }
}

export const soundController = new SoundController();

export const playCheckInSound = () => soundController.playCheckIn();
export const playCheckOutSound = () => soundController.playCheckOut();
export const playErrorSound = () => soundController.playError();
export default soundController;
