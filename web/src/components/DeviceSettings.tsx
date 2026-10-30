import { useEffect, useRef, useState } from "react";

const canPickSpeaker = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

interface Props {
  micId: string;
  speakerId: string;
  onMicChange: (id: string) => void;
  onSpeakerChange: (id: string) => void;
  onClose: () => void;
}

/** Mic + speaker picker with a live input meter — lets you confirm the chosen mic is actually picking up sound. */
export default function DeviceSettings({ micId, speakerId, onMicChange, onSpeakerChange, onClose }: Props) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [level, setLevel] = useState(0);

  const meterStream = useRef<MediaStream>();
  const audioCtx = useRef<AudioContext>();
  const raf = useRef<number>();

  async function refreshDevices() {
    const list = await navigator.mediaDevices.enumerateDevices();
    const inputs = list.filter((d) => d.kind === "audioinput");
    setMics(inputs);
    setSpeakers(list.filter((d) => d.kind === "audiooutput"));
    setNeedsPermission(inputs.length > 0 && inputs.every((d) => !d.label));
  }

  async function grantPermission() {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    await refreshDevices();
  }

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, []);

  // live level meter for whichever mic is currently selected
  useEffect(() => {
    if (needsPermission) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: micId ? { deviceId: { exact: micId } } : true,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        meterStream.current = stream;
        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) { const d = v - 128; sum += d * d; }
          setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* device busy or revoked — meter just stays flat */
      }
    })();

    return () => {
      cancelled = true;
      if (raf.current) cancelAnimationFrame(raf.current);
      meterStream.current?.getTracks().forEach((t) => t.stop());
      void audioCtx.current?.close();
      setLevel(0);
    };
  }, [micId, needsPermission]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 20,
      display: "grid", placeItems: "center",
    }}>
      <div style={{
        width: "min(440px, calc(100vw - 48px))", background: "var(--panel)",
        border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: 28,
        boxShadow: "var(--shadow-shell)",
      }}>
        <div style={{ font: "10px var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 10 }}>
          Audio devices
        </div>
        <h3 style={{ margin: "0 0 18px", font: "400 21px var(--font-serif)", color: "var(--text)" }}>Microphone &amp; speaker</h3>

        {needsPermission ? (
          <button onClick={() => void grantPermission()} style={{
            width: "100%", padding: "12px 0", font: "600 14px var(--font-sans)", color: "var(--accent-text)",
            background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", marginBottom: 8,
          }}>
            Grant mic access to see device names
          </button>
        ) : (
          <>
            <label style={{ display: "block", font: "13px var(--font-sans)", color: "var(--dim)", marginBottom: 6 }}>Microphone</label>
            <select
              value={micId}
              onChange={(e) => onMicChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">System default</option>
              {mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
              ))}
            </select>

            <div style={{ margin: "10px 0 20px" }}>
              <div style={{ font: "12px var(--font-sans)", color: "var(--muted)", marginBottom: 5 }}>
                Input level — talk to confirm this mic hears you
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.round(level * 100)}%`,
                  background: level > 0.05 ? "var(--good)" : "var(--line)",
                  transition: "width .08s linear",
                }} />
              </div>
            </div>

            <label style={{ display: "block", font: "13px var(--font-sans)", color: "var(--dim)", marginBottom: 6 }}>Speaker</label>
            {canPickSpeaker ? (
              <select
                value={speakerId}
                onChange={(e) => onSpeakerChange(e.target.value)}
                style={selectStyle}
              >
                <option value="">System default</option>
                {speakers.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                ))}
              </select>
            ) : (
              <div style={{ font: "13px var(--font-sans)", color: "var(--muted)" }}>
                This browser doesn't support choosing an output device — it'll use your system default.
              </div>
            )}
          </>
        )}

        <button onClick={onClose} style={{
          width: "100%", padding: "12px 0", font: "600 14px var(--font-sans)", color: "var(--text)",
          background: "none", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", cursor: "pointer", marginTop: 20,
        }}>
          Done
        </button>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", font: "14px var(--font-sans)", color: "var(--text)",
  background: "var(--panel2)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)",
  marginBottom: 4, cursor: "pointer",
};
