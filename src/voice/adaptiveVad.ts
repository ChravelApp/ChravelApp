
/**
 * Adaptive Voice Activity Detection (VAD).
 *
 * Calibrates to ambient noise over the first ~500ms, then dynamically
 * determines a speech threshold. Uses hangover frames to avoid
 * false triggers from brief noise spikes.
 */

const CALIBRATION_FRAMES = 25; // ~500ms at 20ms per frame
const THRESHOLD_MULTIPLIER = 3.5;
const MIN_THRESHOLD = 0.01;
const MAX_THRESHOLD = 0.1;
const HANGOVER_FRAMES = 3; // consecutive frames above threshold to trigger

export class AdaptiveVad {
  private calibrationBuffer: number[] = [];
  private threshold = MIN_THRESHOLD;
  private calibrated = false;
  private consecutiveAbove = 0;
  private consecutiveBelow = 0;
  private speaking = false;

  /** Feed an RMS value from one audio frame. Call once per frame (~20ms). */
  feedFrame(rms: number): void {
    if (!this.calibrated) {
      this.calibrationBuffer.push(rms);
      if (this.calibrationBuffer.length >= CALIBRATION_FRAMES) {
        this.calibrate();
      }
      return;
    }

    if (rms > this.threshold) {
      this.consecutiveAbove++;
      this.consecutiveBelow = 0;
      if (this.consecutiveAbove >= HANGOVER_FRAMES) {
        this.speaking = true;
      }
    } else {
      this.consecutiveBelow++;
      this.consecutiveAbove = 0;
      // Require more consecutive silent frames to stop than to start
      if (this.consecutiveBelow >= HANGOVER_FRAMES * 2) {
        this.speaking = false;
      }
    }
  }

  /** Whether the user is currently speaking */
  isSpeaking(): boolean {
    return this.speaking;
  }

  /** Whether calibration is complete */
  isCalibrated(): boolean {
    return this.calibrated;
  }

  /** Get the current dynamic threshold */
  getThreshold(): number {
    return this.threshold;
  }

  /** Reset all state (e.g., on new session) */
  reset(): void {
    this.calibrationBuffer = [];
    this.threshold = MIN_THRESHOLD;
    this.calibrated = false;
    this.consecutiveAbove = 0;
    this.consecutiveBelow = 0;
    this.speaking = false;
  }

  private calibrate(): void {
    const sorted = [...this.calibrationBuffer].sort((a, b) => a - b);
    const medianIdx = Math.floor(sorted.length / 2);
    const median = sorted[medianIdx];

    this.threshold = Math.min(
      MAX_THRESHOLD,
      Math.max(MIN_THRESHOLD, median * THRESHOLD_MULTIPLIER)
    );
    this.calibrated = true;
  }
}
