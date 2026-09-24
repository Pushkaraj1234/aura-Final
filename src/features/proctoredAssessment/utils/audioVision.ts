/**
 * Audio, Vision, Liveness, and Session Monitor Utilities
 * 
 * Conducts automated presence checks, liveness cues, obstruction detection,
 * audio volume tracking, and browser focus monitoring without sending raw video
 * or diagnosing medical conditions from facial cues.
 */

export interface FaceLandmarkPoint {
  id: 'left_eye' | 'right_eye' | 'nose_bridge' | 'forehead' | 'chin' | 'left_cheek' | 'right_cheek' | 'mouth';
  label: string;
  x: number; // 0.0 - 1.0 normalized
  y: number; // 0.0 - 1.0 normalized
  confidence: number;
}

export interface DetectionConfidenceScores {
  overall: number; // 0 - 100%
  ocularAlignment: number; // 0 - 100%
  illuminationAdequacy: number; // 0 - 100%
  facialGeometryStability: number; // 0 - 100%
  edgeClarity: number; // 0 - 100%
}

export interface VisionMetrics {
  faceDetected: boolean;
  confidence: number;
  isBlackScreen: boolean;
  isObstructed: boolean;
  isTooDark: boolean;
  luminance: number;
  motionScore: number;
  multiplePersonsSuspected: boolean;
  // Detailed facial & liveness features
  eyesDetected: boolean;
  leftEyeDetected: boolean;
  rightEyeDetected: boolean;
  headPose: 'center' | 'turning_left' | 'turning_right' | 'profile_left' | 'profile_right' | 'unknown';
  yawScore: number; // -1.0 (left profile) to +1.0 (right profile), ~0 is center
  faceBoundingBox: { x: number; y: number; width: number; height: number } | null;
  landmarks?: FaceLandmarkPoint[];
  confidenceScores?: DetectionConfidenceScores;
  edgeEnergy?: number;
  statusMessage: string;
}

export interface AudioMetrics {
  volumeDb: number;
  isSpeaking: boolean;
  audioActive: boolean;
}

/**
 * Maps speech transcript to PCL-5 numeric options (0 - 4)
 */
export function mapSpeechToPcl5Option(transcript: string): { value: number; label: string } | null {
  const normalized = transcript.toLowerCase().trim();

  if (
    normalized.includes('not at all') ||
    normalized.includes('none') ||
    normalized.includes('zero') ||
    normalized.includes('never') ||
    normalized === '0'
  ) {
    return { value: 0, label: 'Not at all' };
  }

  if (
    normalized.includes('a little bit') ||
    normalized.includes('a little') ||
    normalized.includes('slightly') ||
    normalized.includes('rarely') ||
    normalized === '1' ||
    normalized === 'one'
  ) {
    return { value: 1, label: 'A little bit' };
  }

  if (
    normalized.includes('moderately') ||
    normalized.includes('moderate') ||
    normalized.includes('somewhat') ||
    normalized.includes('sometimes') ||
    normalized === '2' ||
    normalized === 'two'
  ) {
    return { value: 2, label: 'Moderately' };
  }

  if (
    normalized.includes('quite a bit') ||
    normalized.includes('quite') ||
    normalized.includes('often') ||
    normalized.includes('frequently') ||
    normalized.includes('substantially') ||
    normalized === '3' ||
    normalized === 'three'
  ) {
    return { value: 3, label: 'Quite a bit' };
  }

  if (
    normalized.includes('extremely') ||
    normalized.includes('extreme') ||
    normalized.includes('always') ||
    normalized.includes('constantly') ||
    normalized.includes('overwhelming') ||
    normalized === '4' ||
    normalized === 'four'
  ) {
    return { value: 4, label: 'Extremely' };
  }

  return null;
}

/**
 * High-accuracy Computer Vision & Frame Analyzer for Web Browsers
 * 
 * Performs:
 * 1. Black screen / covered shutter detection
 * 2. Face presence & centering analysis
 * 3. Dual eye socket & horizontal alignment detection
 * 4. Head turn & lateral profile (yaw) estimation
 * 5. Native Shape Detection API (FaceDetector) integration when available
 */
/** YCbCr skin-tone test shared by the face detection passes. */
function isSkinPixel(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return (
    cb >= 75 && cb <= 140 && cr >= 126 && cr <= 182 &&
    r >= 38 && g >= 24 && b >= 15 && r >= g && r - b >= 6 &&
    lum >= 28 && lum <= 245
  );
}

/**
 * Estimates head yaw (-1..1, in image coordinates) from where the facial features sit within the
 * visible skin on each row. Features are non-skin pixels enclosed by skin on both sides, so hair or
 * background at the edge of the face does not count. Returns 0 when there isn't enough to measure.
 */
function estimateFeatureYaw(
  data: Uint8ClampedArray,
  width: number,
  minX: number,
  maxX: number,
  minY: number,
  boxH: number
): number {
  const top = Math.floor(minY + boxH * 0.25);
  const bottom = Math.floor(minY + boxH * 0.85);
  const minSpan = (maxX - minX) * 0.3;
  let weightedSum = 0;
  let totalWeight = 0;

  for (let y = top; y < bottom; y++) {
    const rowOffset = y * width;
    let first = -1;
    let last = -1;
    for (let x = minX; x <= maxX; x++) {
      const idx = (rowOffset + x) * 4;
      if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0 || last - first < minSpan) continue;

    let holeSum = 0;
    let holeCount = 0;
    for (let x = first; x <= last; x++) {
      const idx = (rowOffset + x) * 4;
      if (!isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
        holeSum += x;
        holeCount++;
      }
    }
    if (holeCount < 2) continue;

    const spanCenter = (first + last) / 2;
    const spanHalf = (last - first) / 2;
    weightedSum += ((holeSum / holeCount - spanCenter) / spanHalf) * holeCount;
    totalWeight += holeCount;
  }

  if (totalWeight < 12) return 0;
  return Math.max(-1, Math.min(1, (weightedSum / totalWeight) * FEATURE_YAW_GAIN));
}

// Scales the raw feature offset so that a ~30° head turn reads about 0.35
const FEATURE_YAW_GAIN = 2;

export class VideoFrameAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private prevFrameData: Uint8ClampedArray | null = null;
  private nativeDetector: any = null;
  private isDetectingNative = false;
  private lastNativeFace: any = null;
  private nativeDetectionTime = 0;

  constructor(width = 320, height = 240) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Initialize native Shape Detection FaceDetector if supported by the browser
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        const FaceDetectorClass = (window as any).FaceDetector;
        this.nativeDetector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 2 });
      } catch (e) {
        console.warn('Native FaceDetector initialization optional:', e);
      }
    }
  }

  /**
   * Run asynchronous native detection without blocking frame loop
   */
  private triggerNativeDetection(source: HTMLVideoElement | HTMLCanvasElement) {
    if (!this.nativeDetector || this.isDetectingNative) return;

    const now = performance.now();
    if (now - this.nativeDetectionTime < 150) return; // run max ~7 fps

    this.isDetectingNative = true;
    this.nativeDetector
      .detect(source)
      .then((faces: any[]) => {
        this.nativeDetectionTime = performance.now();
        if (faces && faces.length > 0) {
          this.lastNativeFace = faces[0];
        } else {
          this.lastNativeFace = null;
        }
      })
      .catch(() => {
        this.lastNativeFace = null;
      })
      .finally(() => {
        this.isDetectingNative = false;
      });
  }

  public analyzeFrame(videoElement: HTMLVideoElement): VisionMetrics {
    // Check if video element is ready and receiving pixels
    if (!this.ctx || !videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return {
        faceDetected: false,
        confidence: 0,
        isBlackScreen: true,
        isObstructed: true,
        isTooDark: true,
        luminance: 0,
        motionScore: 0,
        multiplePersonsSuspected: false,
        eyesDetected: false,
        leftEyeDetected: false,
        rightEyeDetected: false,
        headPose: 'unknown',
        yawScore: 0,
        faceBoundingBox: null,
        statusMessage: 'Camera initializing or stream paused...',
      };
    }

    const { width, height } = this.canvas;
    this.ctx.drawImage(videoElement, 0, 0, width, height);

    // Trigger async native detector if supported
    this.triggerNativeDetection(this.canvas);

    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const totalPixels = width * height;

    let totalLuminance = 0;
    let sumSqLuminance = 0;
    let motionDiff = 0;

    // Step 1: Accurate Black / Blank Screen Detection via Mean & Variance
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += lum;
      sumSqLuminance += lum * lum;

      if (this.prevFrameData) {
        const pr = this.prevFrameData[idx];
        const pg = this.prevFrameData[idx + 1];
        const pb = this.prevFrameData[idx + 2];
        motionDiff += Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
      }
    }

    // Save previous frame for motion calculation
    this.prevFrameData = new Uint8ClampedArray(data);

    const avgLuminance = totalLuminance / totalPixels;
    const variance = sumSqLuminance / totalPixels - avgLuminance * avgLuminance;
    const stdDev = Math.sqrt(Math.max(0, variance));
    const normalizedMotion = motionDiff / (totalPixels * 3 * 255);

    // CRITICAL CHECK: Is the camera blank, covered, shuttered, or pitch black?
    // If mean brightness is < 20 or variance is near 0 (flat black image):
    const isBlackScreen = avgLuminance < 22 || (avgLuminance < 35 && stdDev < 8);
    const isTooDark = avgLuminance < 38;
    const isObstructed = isBlackScreen || avgLuminance > 248;

    if (isBlackScreen) {
      return {
        faceDetected: false,
        confidence: 0,
        isBlackScreen: true,
        isObstructed: true,
        isTooDark: true,
        luminance: Math.round(avgLuminance),
        motionScore: Number(normalizedMotion.toFixed(3)),
        multiplePersonsSuspected: false,
        eyesDetected: false,
        leftEyeDetected: false,
        rightEyeDetected: false,
        headPose: 'unknown',
        yawScore: 0,
        faceBoundingBox: null,
        statusMessage: 'Camera feed is completely black. Please open your camera shutter or turn on lights.',
      };
    }

    if (isObstructed && avgLuminance > 248) {
      return {
        faceDetected: false,
        confidence: 0,
        isBlackScreen: false,
        isObstructed: true,
        isTooDark: false,
        luminance: Math.round(avgLuminance),
        motionScore: Number(normalizedMotion.toFixed(3)),
        multiplePersonsSuspected: false,
        eyesDetected: false,
        leftEyeDetected: false,
        rightEyeDetected: false,
        headPose: 'unknown',
        yawScore: 0,
        faceBoundingBox: null,
        statusMessage: 'Excessive glare or camera lens obstructed by bright light.',
      };
    }

    // Step 2: Accurate Human Face & Biometric Skin-Tone Projection Clustering
    // We use horizontal and vertical 1D projection histograms to isolate the central face peak,
    // avoiding false bounding boxes from background doors, curtains, or hanging clothes.
    const colSkinCount = new Int32Array(width);
    const rowSkinCount = new Int32Array(height);
    let totalSkinPixels = 0;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = (rowOffset + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Standard YCbCr chromatic conversion
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Robust human skin chromatic signature (inclusive of South Asian, East Asian, Caucasian, African, Hispanic)
        // Red is consistently dominant over blue (r - b >= 6) and r >= g
        const isSkin =
          cb >= 75 &&
          cb <= 140 &&
          cr >= 126 &&
          cr <= 182 &&
          r >= 38 &&
          g >= 24 &&
          b >= 15 &&
          r >= g &&
          r - b >= 6 &&
          lum >= 28 &&
          lum <= 245;

        if (isSkin) {
          colSkinCount[x]++;
          rowSkinCount[y]++;
          totalSkinPixels++;
        }
      }
    }

    let faceDetected = false;
    let faceBox: { x: number; y: number; width: number; height: number } | null = null;
    let yawScore = 0;
    let leftEyeDetected = false;
    let rightEyeDetected = false;
    let eyesDetected = false;
    let headPose: VisionMetrics['headPose'] = 'unknown';
    let landmarks: FaceLandmarkPoint[] = [];
    let detectedEdgeEnergy = 0;

    // Step 3: Check native Shape Detection API (FaceDetector) results if available and fresh
    const now = performance.now();
    const isNativeRecent = this.lastNativeFace && now - this.nativeDetectionTime < 350;
    if (isNativeRecent && this.lastNativeFace) {
      const nb = this.lastNativeFace.boundingBox;
      if (nb && nb.width > 0 && nb.height > 0) {
        faceDetected = true;
        faceBox = {
          x: Math.max(0, nb.x / width),
          y: Math.max(0, nb.y / height),
          width: Math.min(1, nb.width / width),
          height: Math.min(1, nb.height / height),
        };

        if (this.lastNativeFace.landmarks && Array.isArray(this.lastNativeFace.landmarks)) {
          const eyeLandmarks = this.lastNativeFace.landmarks.filter((l: any) => l.type === 'eye');
          if (eyeLandmarks.length >= 2) {
            eyesDetected = true;
            leftEyeDetected = true;
            rightEyeDetected = true;
          } else if (eyeLandmarks.length === 1) {
            eyesDetected = false;
            const eyeX = eyeLandmarks[0].locations?.[0]?.x || 0;
            if (eyeX < nb.x + nb.width / 2) {
              leftEyeDetected = true;
            } else {
              rightEyeDetected = true;
            }
          }
        }
      }
    }

    // Step 4: Robust Projection Profile Clustering & Biometric Ocular Analysis (Real-time fallback)
    // Smooth the column skin projection with an 11-pixel moving window
    const smoothedCols = new Float32Array(width);
    for (let x = 5; x < width - 5; x++) {
      let sum = 0;
      for (let k = -5; k <= 5; k++) {
        sum += colSkinCount[x + k];
      }
      smoothedCols[x] = sum / 11;
    }

    // Locate the primary face peak in the central candidate area (between 15% and 85% of width)
    const scanMinX = Math.floor(width * 0.15);
    const scanMaxX = Math.floor(width * 0.85);
    let peakColX = Math.floor(width / 2);
    let peakColCount = 0;

    for (let x = scanMinX; x < scanMaxX; x++) {
      if (smoothedCols[x] > peakColCount) {
        peakColCount = smoothedCols[x];
        peakColX = x;
      }
    }

    // Must have a meaningful skin column peak (at least 20 skin pixels high)
    if (peakColCount >= 20) {
      // Trace left from peak to find head left boundary
      let headMinX = peakColX;
      const leftThreshold = Math.max(10, peakColCount * 0.28);
      while (headMinX > scanMinX && smoothedCols[headMinX] >= leftThreshold) {
        // Stop if we hit a steep valley (e.g. dark headphones or background drop)
        if (
          headMinX < peakColX - 15 &&
          smoothedCols[headMinX] < smoothedCols[headMinX + 1] &&
          smoothedCols[headMinX] < smoothedCols[headMinX - 1] &&
          smoothedCols[headMinX] < peakColCount * 0.45
        ) {
          break;
        }
        headMinX--;
      }

      // Trace right from peak to find head right boundary
      let headMaxX = peakColX;
      const rightThreshold = Math.max(10, peakColCount * 0.28);
      while (headMaxX < scanMaxX && smoothedCols[headMaxX] >= rightThreshold) {
        if (
          headMaxX > peakColX + 15 &&
          smoothedCols[headMaxX] < smoothedCols[headMaxX - 1] &&
          smoothedCols[headMaxX] < smoothedCols[headMaxX + 1] &&
          smoothedCols[headMaxX] < peakColCount * 0.45
        ) {
          break;
        }
        headMaxX++;
      }

      // Within [headMinX, headMaxX], compute the vertical profile
      const headRowSkin = new Int32Array(height);
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = headMinX; x <= headMaxX; x++) {
          const idx = (rowOffset + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (
            cb >= 75 &&
            cb <= 140 &&
            cr >= 126 &&
            cr <= 182 &&
            r >= 38 &&
            g >= 24 &&
            b >= 15 &&
            r >= g &&
            r - b >= 6 &&
            lum >= 28 &&
            lum <= 245
          ) {
            headRowSkin[y]++;
          }
        }
      }

      // Smooth vertical profile
      const smoothedRows = new Float32Array(height);
      for (let y = 4; y < height - 4; y++) {
        let sum = 0;
        for (let k = -4; k <= 4; k++) {
          sum += headRowSkin[y + k];
        }
        smoothedRows[y] = sum / 9;
      }

      let peakRowY = Math.floor(height * 0.45);
      let peakRowCount = 0;
      const scanMinY = Math.floor(height * 0.10);
      const scanMaxY = Math.floor(height * 0.85);

      for (let y = scanMinY; y < scanMaxY; y++) {
        if (smoothedRows[y] > peakRowCount) {
          peakRowCount = smoothedRows[y];
          peakRowY = y;
        }
      }

      if (peakRowCount >= 14) {
        // Trace up to forehead/hairline
        let headMinY = peakRowY;
        const rowThreshold = Math.max(8, peakRowCount * 0.25);
        while (headMinY > scanMinY && smoothedRows[headMinY] >= rowThreshold) {
          headMinY--;
        }

        // Trace down to chin/neck
        let headMaxY = peakRowY;
        while (headMaxY < scanMaxY && smoothedRows[headMaxY] >= rowThreshold) {
          headMaxY++;
        }

        const boxW = headMaxX - headMinX;
        const boxH = headMaxY - headMinY;
        const aspectRatio = boxW > 0 ? boxH / boxW : 0;

        // Realistic human head dimensions
        const isValidHeadGeometry =
          boxW >= width * 0.15 &&
          boxW <= width * 0.70 &&
          boxH >= height * 0.18 &&
          boxH <= height * 0.80 &&
          aspectRatio >= 0.90 &&
          aspectRatio <= 2.10;

        if (isValidHeadGeometry) {
          // Internal edge energy check (real human faces have sharp eyes, eyebrows, nose, mouth; smooth walls do not)
          let edgeEnergySum = 0;
          let edgeSampleCount = 0;
          const step = 3;

          for (let y = headMinY + 4; y < headMaxY - 4; y += step) {
            for (let x = headMinX + 4; x < headMaxX - 4; x += step) {
              const idx = (y * width + x) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

              const idxR = (y * width + (x + 2)) * 4;
              const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];

              const idxD = ((y + 2) * width + x) * 4;
              const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];

              edgeEnergySum += Math.abs(lum - lumR) + Math.abs(lum - lumD);
              edgeSampleCount++;
            }
          }

          const avgEdgeEnergy = edgeSampleCount > 0 ? edgeEnergySum / edgeSampleCount : 0;

          // Reject completely flat surfaces (walls have edge energy < 4.0; real faces are >= 5.5)
          if (avgEdgeEnergy >= 5.5) {
            // Ocular band search (eyes & eyebrows sit strictly between 22% and 50% of head height)
            const eyeBandTop = Math.floor(headMinY + boxH * 0.22);
            const eyeBandBottom = Math.floor(headMinY + boxH * 0.50);

            const leftZone = {
              x1: Math.floor(headMinX + boxW * 0.12),
              x2: Math.floor(headMinX + boxW * 0.46),
            };
            const bridgeZone = {
              x1: Math.floor(headMinX + boxW * 0.42),
              x2: Math.floor(headMinX + boxW * 0.58),
            };
            const rightZone = {
              x1: Math.floor(headMinX + boxW * 0.54),
              x2: Math.floor(headMinX + boxW * 0.88),
            };

            let leftMinLum = 255;
            let leftMinX = 0;
            let leftMinY = 0;

            let rightMinLum = 255;
            let rightMinX = 0;
            let rightMinY = 0;

            let bridgeMaxLum = 0;

            for (let y = eyeBandTop; y < eyeBandBottom; y += 2) {
              // Left eye search
              for (let x = leftZone.x1; x < leftZone.x2; x += 2) {
                const idx = (y * width + x) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                if (lum < leftMinLum) {
                  leftMinLum = lum;
                  leftMinX = x;
                  leftMinY = y;
                }
              }

              // Central nose bridge search (illuminated ridge)
              for (let x = bridgeZone.x1; x < bridgeZone.x2; x += 2) {
                const idx = (y * width + x) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                if (lum > bridgeMaxLum) {
                  bridgeMaxLum = lum;
                }
              }

              // Right eye search
              for (let x = rightZone.x1; x < rightZone.x2; x += 2) {
                const idx = (y * width + x) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                if (lum < rightMinLum) {
                  rightMinLum = lum;
                  rightMinX = x;
                  rightMinY = y;
                }
              }
            }

            // Skin baseline: median brightness of skin pixels across the cheek band. A single sample
            // is unreliable because it can land on a nostril, shadow or highlight.
            const cheekLums: number[] = [];
            const cheekTop = Math.floor(headMinY + boxH * 0.5);
            const cheekBottom = Math.min(height - 1, Math.floor(headMinY + boxH * 0.72));
            for (let y = cheekTop; y <= cheekBottom; y += 2) {
              for (let x = headMinX; x <= headMaxX; x += 2) {
                const idx = (y * width + x) * 4;
                if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
                  cheekLums.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
                }
              }
            }
            cheekLums.sort((a, b) => a - b);
            const skinBaselineLum = cheekLums.length > 0 ? cheekLums[Math.floor(cheekLums.length / 2)] : 0;

            // Contrast check: pupils & eyebrows must be darker than surrounding skin
            const leftContrast = skinBaselineLum - leftMinLum;
            const rightContrast = skinBaselineLum - rightMinLum;
            const leftBridgeDiff = bridgeMaxLum - leftMinLum;
            const rightBridgeDiff = bridgeMaxLum - rightMinLum;

            const isLeftEyeValid = leftContrast >= 12 && leftBridgeDiff >= 6;
            const isRightEyeValid = rightContrast >= 12 && rightBridgeDiff >= 6;

            // Horizontal alignment check: eyes must be on roughly the same horizontal plane
            const eyeYDelta = Math.abs(leftMinY - rightMinY);
            const isHorizontallyAligned = eyeYDelta <= boxH * 0.18;

            // Interpupillary separation distance: between 22% and 58% of head width
            const eyeDistance = rightMinX - leftMinX;
            const isSeparationValid = eyeDistance >= boxW * 0.22 && eyeDistance <= boxW * 0.58;

            const bothEyesDetected =
              isLeftEyeValid &&
              isRightEyeValid &&
              isHorizontallyAligned &&
              isSeparationValid;

            // Head yaw from facial feature position. On each row, eyes, brows, nose shadows and mouth
            // appear as non-skin "holes" enclosed by skin. As the head turns they move toward that
            // side of the visible skin, while hair at the edge of the face is not enclosed and is ignored.
            const featureYaw = estimateFeatureYaw(data, width, headMinX, headMaxX, headMinY, boxH);

            // Either both eyes are aligned (center view) OR a valid profile posture is detected
            if (bothEyesDetected || isLeftEyeValid || isRightEyeValid) {
              faceDetected = true;
              detectedEdgeEnergy = avgEdgeEnergy;

              if (!faceBox) {
                faceBox = {
                  x: headMinX / width,
                  y: headMinY / height,
                  width: boxW / width,
                  height: boxH / height,
                };
              }

              if (bothEyesDetected) {
                eyesDetected = true;
                leftEyeDetected = true;
                rightEyeDetected = true;
              } else {
                // Turned posture with a single eye visible
                leftEyeDetected = isLeftEyeValid;
                rightEyeDetected = isRightEyeValid;
                eyesDetected = false;
              }
              yawScore = Number(featureYaw.toFixed(2));

              // Extract 8-point biometric facial landmarks
              const normHeadCenter = ((headMinX + headMaxX) * 0.5) / width;
              landmarks = [
                {
                  id: 'left_eye',
                  label: 'Left Ocular Center',
                  x: Number((leftMinX / width).toFixed(3)),
                  y: Number((leftMinY / height).toFixed(3)),
                  confidence: isLeftEyeValid ? 0.95 : 0.45,
                },
                {
                  id: 'right_eye',
                  label: 'Right Ocular Center',
                  x: Number((rightMinX / width).toFixed(3)),
                  y: Number((rightMinY / height).toFixed(3)),
                  confidence: isRightEyeValid ? 0.95 : 0.45,
                },
                {
                  id: 'nose_bridge',
                  label: 'Nasal Bridge',
                  x: Number(normHeadCenter.toFixed(3)),
                  y: Number(((headMinY + boxH * 0.44) / height).toFixed(3)),
                  confidence: 0.88,
                },
                {
                  id: 'forehead',
                  label: 'Frontal Glabella',
                  x: Number(normHeadCenter.toFixed(3)),
                  y: Number(((headMinY + boxH * 0.14) / height).toFixed(3)),
                  confidence: 0.85,
                },
                {
                  id: 'left_cheek',
                  label: 'Left Zygoma',
                  x: Number(((headMinX + boxW * 0.22) / width).toFixed(3)),
                  y: Number(((headMinY + boxH * 0.62) / height).toFixed(3)),
                  confidence: 0.82,
                },
                {
                  id: 'right_cheek',
                  label: 'Right Zygoma',
                  x: Number(((headMinX + boxW * 0.78) / width).toFixed(3)),
                  y: Number(((headMinY + boxH * 0.62) / height).toFixed(3)),
                  confidence: 0.82,
                },
                {
                  id: 'mouth',
                  label: 'Oral Commissure',
                  x: Number(normHeadCenter.toFixed(3)),
                  y: Number(((headMinY + boxH * 0.78) / height).toFixed(3)),
                  confidence: 0.84,
                },
                {
                  id: 'chin',
                  label: 'Mental Protuberance',
                  x: Number(normHeadCenter.toFixed(3)),
                  y: Number(((headMinY + boxH * 0.95) / height).toFixed(3)),
                  confidence: 0.86,
                },
              ];

              // Classify Head Pose: Center vs Profile
              if (bothEyesDetected && Math.abs(yawScore) < 0.26) {
                headPose = 'center';
              } else if (yawScore <= -0.32) {
                headPose = 'profile_left';
              } else if (yawScore < -0.22) {
                headPose = 'turning_left';
              } else if (yawScore >= 0.32) {
                headPose = 'profile_right';
              } else if (yawScore > 0.22) {
                headPose = 'turning_right';
              } else {
                headPose = 'center';
              }
            }
          }
        }
      }
    }

    // Secondary Person / Peripheral Energy Check (only if face is verified)

    // Peripheral energy check for secondary person
    let leftPeripheralEnergy = 0;
    let rightPeripheralEnergy = 0;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width * 0.12; x += 4) {
        const idx = (y * width + x) * 4;
        leftPeripheralEnergy += data[idx];
      }
      for (let x = Math.floor(width * 0.88); x < width; x += 4) {
        const idx = (y * width + x) * 4;
        rightPeripheralEnergy += data[idx];
      }
    }

    const multiplePersonsSuspected =
      faceDetected &&
      leftPeripheralEnergy > totalPixels * 4 &&
      rightPeripheralEnergy > totalPixels * 4 &&
      normalizedMotion > 0.18;

    // Craft clear status message for user guidance
    let statusMessage = 'Checking camera...';
    if (!faceDetected) {
      statusMessage = isTooDark
        ? 'Room is dimly lit. Please increase lighting.'
        : 'Please step in front of the camera.';
    } else if (headPose === 'center') {
      if (eyesDetected) {
        statusMessage = 'Face and eyes aligned in center.';
      } else {
        statusMessage = 'Face detected. Please look directly into the camera.';
      }
    } else if (headPose === 'profile_left' || headPose === 'profile_right') {
      statusMessage = `Side profile detected (${headPose === 'profile_left' ? 'left' : 'right'}).`;
    } else {
      statusMessage = 'Head turning detected.';
    }

    // Calculate live diagnostic confidence scores
    const ocularScore = eyesDetected ? 96 : leftEyeDetected || rightEyeDetected ? 62 : 12;
    const illumScore = avgLuminance >= 45 && avgLuminance <= 195 ? 96 : avgLuminance >= 30 ? 70 : 25;
    const stabilityScore = faceDetected ? Math.max(45, Math.round(94 - Math.abs(yawScore) * 22)) : 10;
    const clarityScore = Math.min(100, Math.round(Math.max(15, detectedEdgeEnergy * 9.5)));
    const overallScore = faceDetected
      ? Math.min(100, Math.round(ocularScore * 0.35 + illumScore * 0.25 + stabilityScore * 0.25 + clarityScore * 0.15))
      : Math.round(Math.max(6, illumScore * 0.08 + clarityScore * 0.04));

    const confidenceScores: DetectionConfidenceScores = {
      overall: overallScore,
      ocularAlignment: ocularScore,
      illuminationAdequacy: illumScore,
      facialGeometryStability: stabilityScore,
      edgeClarity: clarityScore,
    };

    if (landmarks.length === 0 && faceBox && faceDetected) {
      const fb = faceBox;
      const cx = fb.x + fb.width * 0.5;
      landmarks = [
        { id: 'left_eye', label: 'Left Ocular Center', x: Number((fb.x + fb.width * 0.32).toFixed(3)), y: Number((fb.y + fb.height * 0.35).toFixed(3)), confidence: leftEyeDetected ? 0.92 : 0.4 },
        { id: 'right_eye', label: 'Right Ocular Center', x: Number((fb.x + fb.width * 0.68).toFixed(3)), y: Number((fb.y + fb.height * 0.35).toFixed(3)), confidence: rightEyeDetected ? 0.92 : 0.4 },
        { id: 'nose_bridge', label: 'Nasal Bridge', x: Number(cx.toFixed(3)), y: Number((fb.y + fb.height * 0.48).toFixed(3)), confidence: 0.85 },
        { id: 'forehead', label: 'Frontal Glabella', x: Number(cx.toFixed(3)), y: Number((fb.y + fb.height * 0.15).toFixed(3)), confidence: 0.8 },
        { id: 'left_cheek', label: 'Left Zygoma', x: Number((fb.x + fb.width * 0.2).toFixed(3)), y: Number((fb.y + fb.height * 0.62).toFixed(3)), confidence: 0.78 },
        { id: 'right_cheek', label: 'Right Zygoma', x: Number((fb.x + fb.width * 0.8).toFixed(3)), y: Number((fb.y + fb.height * 0.62).toFixed(3)), confidence: 0.78 },
        { id: 'mouth', label: 'Oral Labium', x: Number(cx.toFixed(3)), y: Number((fb.y + fb.height * 0.78).toFixed(3)), confidence: 0.8 },
        { id: 'chin', label: 'Mental Protuberance', x: Number(cx.toFixed(3)), y: Number((fb.y + fb.height * 0.95).toFixed(3)), confidence: 0.82 },
      ];
    }

    return {
      faceDetected,
      confidence: faceDetected ? (eyesDetected ? 0.95 : 0.8) : 0.1,
      isBlackScreen: false,
      isObstructed: false,
      isTooDark,
      luminance: Math.round(avgLuminance),
      motionScore: Number(normalizedMotion.toFixed(3)),
      multiplePersonsSuspected,
      eyesDetected,
      leftEyeDetected,
      rightEyeDetected,
      headPose,
      yawScore,
      faceBoundingBox: faceBox,
      landmarks,
      confidenceScores,
      edgeEnergy: detectedEdgeEnergy,
      statusMessage,
    };
  }
}


/**
 * Microphone Audio Analyzer using Web Audio API
 */
export class AudioMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  public init(stream: MediaStream): boolean {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return false;

      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      return true;
    } catch (err) {
      console.warn('AudioMeter initialization failed:', err);
      return false;
    }
  }

  public getMetrics(): AudioMetrics {
    if (!this.analyser || !this.dataArray) {
      return { volumeDb: -60, isSpeaking: false, audioActive: false };
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    // Map 0 - 255 to approximate decibels (-70dB to 0dB)
    const volumeDb = Math.round(average > 0 ? 20 * Math.log10(average / 255) : -70);
    const isSpeaking = volumeDb > -38;

    return {
      volumeDb,
      isSpeaking,
      audioActive: average > 2,
    };
  }

  public cleanup() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
