"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionRunner } from "./operation-modules";
import type { Snapshot } from "./operations-dashboard";

type FaceApi = {
  nets: {
    tinyFaceDetector: {
      loadFromUri: (uri: string) => Promise<void>;
    };
    faceLandmark68Net: {
      loadFromUri: (uri: string) => Promise<void>;
    };
    faceRecognitionNet: {
      loadFromUri: (uri: string) => Promise<void>;
    };
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
};

async function loadFaceApi() {
  const browser = window as typeof window & {
    faceapi?: FaceApi;
  };

  if (!browser.faceapi) {
    await new Promise<void>((resolve, reject) => {
      const existing =
        document.querySelector<HTMLScriptElement>(
          'script[data-face-api="true"]'
        );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(),
          { once: true }
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error("Face library could not be loaded")
            ),
          { once: true }
        );

        return;
      }

      const script = document.createElement("script");

      script.src = "/face-models/face-api.js";
      script.async = true;
      script.dataset.faceApi = "true";

      script.onload = () => resolve();

      script.onerror = () =>
        reject(
          new Error("Face library could not be loaded")
        );

      document.head.appendChild(script);
    });
  }

  if (!browser.faceapi) {
    throw new Error("Face library did not initialize");
  }

  /*
   * Enrollment needs:
   * 1. Tiny Face Detector
   * 2. Face Landmarks (required internally by face-api.js to align the
   *    face crop before it can extract a recognition descriptor - this is
   *    plumbing for withFaceDescriptors(), not the same thing as blink
   *    liveness checking, and cannot be skipped)
   * 3. Face Recognition Network
   */
  await Promise.all([
    browser.faceapi.nets.tinyFaceDetector.loadFromUri(
      "/face-models"
    ),

    browser.faceapi.nets.faceLandmark68Net.loadFromUri(
      "/face-models"
    ),

    browser.faceapi.nets.faceRecognitionNet.loadFromUri(
      "/face-models"
    ),
  ]);

  return browser.faceapi;
}

function averageDescriptors(samples: number[][]) {
  /*
   * Plain elementwise average.
   *
   * face-api.js descriptors are compared using raw Euclidean
   * distance during scanning, so the averaged descriptor is
   * intentionally not normalized here.
   */
  return Array.from(
    { length: 128 },
    (_, index) =>
      samples.reduce(
        (sum, sample) => sum + sample[index],
        0
      ) / samples.length
  );
}

export function FaceEnrollmentPanel({
  snapshot,
  onAction,
  notify,
}: {
  snapshot: Snapshot;
  onAction: ActionRunner;
  notify: (message: string) => void;
}) {
  const [selectedOperatorId, setSelectedOperatorId] =
    useState(snapshot.operators[0]?.id ?? "");

  const [consent, setConsent] = useState(false);

  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [samples, setSamples] =
    useState<number[][]>([]);

  const [busy, setBusy] =
    useState(false);

  const [status, setStatus] = useState(
    "Select an operator and confirm written consent."
  );

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const enrollmentById = useMemo(
    () =>
      new Map(
        snapshot.faceEnrollments.map(
          (item) => [item.operator_id, item]
        )
      ),
    [snapshot.faceEnrollments]
  );

  useEffect(() => {
    return () =>
      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
  }, []);

  async function openCamera() {
    if (!consent) {
      notify(
        "Confirm documented operator consent before opening the camera"
      );

      return;
    }

    setBusy(true);

    try {
      await loadFaceApi();

      streamRef.current =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        });

      setCameraOpen(true);

      setSamples([]);

      setStatus(
        "Camera ready. Capture three clear samples with one face in view."
      );

      requestAnimationFrame(() => {
        if (
          videoRef.current &&
          streamRef.current
        ) {
          videoRef.current.srcObject =
            streamRef.current;

          void videoRef.current.play();
        }
      });
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Camera could not be opened"
      );
    } finally {
      setBusy(false);
    }
  }

  function closeCamera() {
    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    streamRef.current = null;

    setCameraOpen(false);

    setSamples([]);
  }

  async function captureSample() {
    if (!videoRef.current) return;

    setBusy(true);

    try {
      const faceapi = await loadFaceApi();

      /*
       * Enrollment prioritizes accuracy over speed.
       */
      const options =
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.6,
        });

      /*
       * Face landmarks are required by withFaceDescriptors() internally
       * (used to align the face before extracting the recognition
       * descriptor) even though enrollment does not use them for liveness.
       */
      const faces = await faceapi
        .detectAllFaces(
          videoRef.current,
          options
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (faces.length !== 1) {
        throw new Error(
          faces.length > 1
            ? "Only the selected operator should be in view"
            : "No clear face was detected"
        );
      }

      const next = [
        ...samples,
        Array.from(faces[0].descriptor),
      ];

      setSamples(next);

      setStatus(
        next.length < 3
          ? `Sample ${next.length} captured. Change angle slightly and capture again.`
          : "Three samples captured. Save the encrypted face template."
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Face sample could not be captured"
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEnrollment() {
    if (
      samples.length < 3 ||
      !selectedOperatorId ||
      !consent
    ) {
      return;
    }

    setBusy(true);

    try {
      await onAction({
        action: "enrollOperatorFace",
        operatorId: selectedOperatorId,
        descriptor: averageDescriptors(samples),
        sampleCount: samples.length,
        consentGranted: true,
      });

      const operator =
        snapshot.operators.find(
          (item) =>
            item.id === selectedOperatorId
        );

      notify(
        `${operator?.name ?? "Operator"} face enrollment saved securely`
      );

      closeCamera();

      setConsent(false);

      setStatus(
        "Enrollment complete. Raw camera images were not stored."
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(operatorId: string) {
    const operator =
      snapshot.operators.find(
        (item) => item.id === operatorId
      );

    if (
      !window.confirm(
        `Revoke face recognition for ${operator?.name ?? "this operator"
        }? QR and employee ID will still work.`
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await onAction({
        action: "revokeOperatorFace",
        operatorId,
      });

      notify(
        `${operator?.name ?? "Operator"} face enrollment revoked`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel face-enrollment-panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">
            Optional biometric identification
          </p>

          <h2>Operator face enrollment</h2>
        </div>

        <span className="face-enrollment-count">
          {
            snapshot.faceEnrollments.filter(
              (item) => item.enrolled
            ).length
          }{" "}
          enrolled
        </span>
      </div>

      <div className="face-enrollment-layout">
        <div className="face-enrollment-controls">
          <label className="form-field">
            <span>Operator</span>

            <select
              value={selectedOperatorId}
              onChange={(event) => {
                setSelectedOperatorId(
                  event.target.value
                );

                setSamples([]);
              }}
            >
              {snapshot.operators
                .filter(
                  (operator) =>
                    operator.status === "Active"
                )
                .map((operator) => (
                  <option
                    value={operator.id}
                    key={operator.id}
                  >
                    {operator.employee_code} ·{" "}
                    {operator.name} ·{" "}
                    {operator.plant}
                  </option>
                ))}
            </select>
          </label>

          <label className="face-consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) =>
                setConsent(event.target.checked)
              }
            />

            <span>
              I confirm that the operator gave
              informed, documented consent and was
              told QR/employee ID remains available.
            </span>
          </label>

          <p className="face-enrollment-status">
            {status}
          </p>

          {!cameraOpen ? (
            <button
              className="primary-action"
              type="button"
              disabled={
                busy ||
                !selectedOperatorId ||
                !consent
              }
              onClick={() =>
                void openCamera()
              }
            >
              Open enrollment camera
            </button>
          ) : (
            <div className="face-camera-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={closeCamera}
              >
                Cancel
              </button>

              <button
                className="secondary-action"
                type="button"
                disabled={
                  busy || samples.length >= 3
                }
                onClick={() =>
                  void captureSample()
                }
              >
                Capture sample ({samples.length}/3)
              </button>

              <button
                className="primary-action"
                type="button"
                disabled={
                  busy || samples.length < 3
                }
                onClick={() =>
                  void saveEnrollment()
                }
              >
                Save encrypted template
              </button>
            </div>
          )}

          <div
            className={
              cameraOpen
                ? "face-enrollment-camera open"
                : "face-enrollment-camera"
            }
          >
            <video
              ref={videoRef}
              muted
              playsInline
            />

            <span />
          </div>

          <small className="face-privacy-copy">
            Only a mathematical 128-value template
            is encrypted and saved. Camera frames
            are processed locally and are never
            uploaded or retained.
          </small>
        </div>

        <div className="face-enrollment-list">
          <strong>Enrollment status</strong>

          <div>
            {snapshot.operators
              .filter(
                (operator) =>
                  operator.status === "Active"
              )
              .map((operator) => {
                const enrollment =
                  enrollmentById.get(operator.id);

                return (
                  <article key={operator.id}>
                    <span>
                      <b>{operator.name}</b>

                      <small>
                        {operator.employee_code} ·{" "}
                        {operator.plant}
                      </small>
                    </span>

                    <em
                      className={
                        enrollment?.enrolled
                          ? "enrolled"
                          : ""
                      }
                    >
                      {enrollment?.enrolled
                        ? "Enrolled"
                        : "Not enrolled"}
                    </em>

                    {enrollment?.enrolled ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void revoke(
                            operator.id
                          )
                        }
                      >
                        Revoke
                      </button>
                    ) : null}
                  </article>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}