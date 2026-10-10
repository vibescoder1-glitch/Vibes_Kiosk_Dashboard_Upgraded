"use client";

import { useEffect, useRef, useState } from "react";

type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (options: {
    inputSize: number;
    scoreThreshold: number;
  }) => unknown;
  detectAllFaces: (
    input: HTMLVideoElement,
    options: unknown
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptors: () => Promise<
        Array<{
          descriptor: Float32Array;
        }>
      >;
    };
  };
  euclideanDistance: (
    left: ArrayLike<number>,
    right: ArrayLike<number>
  ) => number;
};

declare global {
  interface Window {
    faceapi?: FaceApi;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

type Candidate = {
  id: string;
  employeeCode: string;
  name: string;
  plant: string;
  shift: string;
  skillLevel: string;
  descriptor: number[];
};

type ScanPayload = {
  plant: string;
  operators: Candidate[];
  threshold: number;
  expiresAt: string;
};

function postToApp(payload: Record<string, unknown>) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
}

async function loadFaceApi() {
  if (window.faceapi) return window.faceapi;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.src = "/face-models/face-api.js";
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Face recognition library could not be loaded"));

    document.head.appendChild(script);
  });

  if (!window.faceapi) {
    throw new Error("Face recognition library did not initialize");
  }

  return window.faceapi;
}

export default function FaceScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stoppedRef = useRef(false);

  const [status, setStatus] = useState("Preparing secure face scan…");
  const [detail, setDetail] = useState(
    "Keep your face centered for automatic recognition."
  );
  const [error, setError] = useState("");
  const [matched, setMatched] = useState<Candidate | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    stoppedRef.current = false;

    async function start() {
      try {
        const session =
          new URLSearchParams(window.location.search).get("session") ?? "";

        if (!session) {
          throw new Error("Face scan session is missing");
        }

        const response = await fetch(
          `/api/face-scan?session=${encodeURIComponent(session)}`,
          {
            cache: "no-store",
          }
        );

        const body = (await response.json()) as ScanPayload & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            body.error ?? "Face scan session could not be opened"
          );
        }

        if (!body.operators.length) {
          throw new Error(
            `No operators in ${body.plant} have an enrolled face`
          );
        }

        const faceapi = await loadFaceApi();

        /*
         * Only load the models required for recognition.
         * Facial landmarks are not required because blink detection
         * has been removed from the scanner.
         */
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/face-models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/face-models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/face-models"),
        ]);

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!videoRef.current) {
          throw new Error("Camera preview is unavailable");
        }

        videoRef.current.srcObject = stream;

        await videoRef.current.play();

        setStatus("Look at the camera");
        setDetail(
          `${body.operators.length} consented operator profiles available for ${body.plant}.`
        );

        /*
         * Faster detector configuration.
         * 224 is considerably lighter than 320 while still suitable
         * for a kiosk face positioned reasonably close to the camera.
         */
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5,
        });

        let stableCandidate = "";
        let stableCount = 0;

        /*
         * The previous scanner waited up to 45 seconds.
         * A kiosk scan should fail fast and fall back to QR.
         */
        const deadline = Date.now() + 15_000;

        while (!stoppedRef.current && Date.now() < deadline) {
          const faces = await faceapi
            .detectAllFaces(videoRef.current, options)
            .withFaceLandmarks()
            .withFaceDescriptors();

          /*
           * Exactly one face must be visible.
           */
          if (faces.length !== 1) {
            setStatus(
              faces.length > 1
                ? "Only one person should be in view"
                : "Center your face in the frame"
            );

            stableCandidate = "";
            stableCount = 0;

            await new Promise((resolve) => setTimeout(resolve, 120));

            continue;
          }

          const face = faces[0];

          /*
           * Compare the detected face against all enrolled operators.
           */
          const ranked = body.operators
            .map((operator) => ({
              operator,
              distance: faceapi.euclideanDistance(
                face.descriptor,
                operator.descriptor
              ),
            }))
            .sort((left, right) => left.distance - right.distance);

          const best = ranked[0];
          const second = ranked[1];

          /*
           * Reject:
           * - no candidate
           * - distance above configured threshold
           * - ambiguous match where the second candidate is too close
           */
          if (
            !best ||
            best.distance > body.threshold ||
            (second && second.distance - best.distance < 0.08)
          ) {
            stableCandidate = "";
            stableCount = 0;

            setStatus(
              "Face not recognized—hold still or use your QR badge"
            );

            await new Promise((resolve) => setTimeout(resolve, 200));

            continue;
          }

          /*
           * Require the same operator to be recognized twice consecutively.
           * This replaces the old blink-based confirmation.
           */
          if (stableCandidate === best.operator.id) {
            stableCount += 1;
          } else {
            stableCandidate = best.operator.id;
            stableCount = 1;
          }

          setStatus(`Verifying ${best.operator.name}…`);

          if (stableCount < 2) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            continue;
          }

          /*
           * Final server-side verification.
           *
           * "passive" means the client is using stable face matching
           * rather than an explicit blink challenge.
           */
          const verification = await fetch(
            `/api/face-scan?session=${encodeURIComponent(session)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                operatorId: best.operator.id,
                distance: best.distance,
                liveness: "passive",
              }),
            }
          );

          const verified = (await verification.json()) as {
            error?: string;
          };

          if (!verification.ok) {
            throw new Error(
              verified.error ?? "Face match could not be confirmed"
            );
          }

          stoppedRef.current = true;

          setMatched(best.operator);

          setStatus(`Welcome, ${best.operator.name}`);

          setDetail(
            `${best.operator.employeeCode} · ${best.operator.plant} · ${best.operator.shift} · ${best.operator.skillLevel}`
          );

          postToApp({
            type: "face-match",
            operatorId: best.operator.id,
          });

          return;
        }

        if (!stoppedRef.current) {
          throw new Error(
            "Face scan timed out. Please use your QR badge or try again."
          );
        }
      } catch (scanError) {
        const message =
          scanError instanceof Error
            ? scanError.message
            : "Face scan failed";

        setError(message);

        setStatus("Face scan unavailable");

        setDetail(
          "Use the operator QR code or employee ID to continue."
        );
      }
    }

    void start();

    return () => {
      stoppedRef.current = true;

      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <main className="face-scan-page">
      <section className="face-scan-card">
        <div className="face-scan-brand">VC</div>

        <p className="eyebrow">
          Consent-based operator identification
        </p>

        <h1>{status}</h1>

        <p>{detail}</p>

        <div
          className={
            matched
              ? "face-video-frame matched"
              : "face-video-frame"
          }
        >
          <video
            ref={videoRef}
            muted
            playsInline
          />

          <span />
        </div>

        {error ? (
          <div className="face-scan-error">
            {error}
          </div>
        ) : null}

        <p className="face-privacy-note">
          Face recognition is consent-based. Video stays on this
          device and is not uploaded or stored.
        </p>

        <button
          type="button"
          onClick={() =>
            postToApp({
              type: "face-cancel",
            })
          }
        >
          Use QR or employee ID instead
        </button>
      </section>
    </main>
  );
}