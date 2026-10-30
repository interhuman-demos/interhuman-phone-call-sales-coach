/** Mic capture (push-to-talk) and buyer voice playback. */

export class Recorder {
  private stream?: MediaStream;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async init(deviceId?: string): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true, noiseSuppression: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
  }

  /** Start recording. onChunk fires ~every 250ms with just the new bytes (for continuous streaming). */
  start(onChunk?: (chunk: Blob) => void): void {
    if (!this.stream) throw new Error("recorder not initialized");
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream, { mimeType: "audio/webm;codecs=opus" });
    this.rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      this.chunks.push(e.data);
      onChunk?.(e.data);
    };
    this.startedAt = performance.now();
    this.rec.start(250); // small timeslice → frequent chunks instead of one blob at stop()
  }

  /** Snapshot of everything captured so far, as a standalone decodable webm (chunk 0 carries the header). */
  snapshot(): Blob {
    return new Blob(this.chunks, { type: "audio/webm" });
  }

  /** Release the mic entirely (end of call). */
  dispose(): void {
    if (this.rec && this.rec.state !== "inactive") this.rec.stop();
    this.rec = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
  }

  /** Stop and return the utterance blob + duration. */
  stop(): Promise<{ blob: Blob; durationMs: number }> {
    return new Promise((resolve) => {
      const rec = this.rec!;
      rec.onstop = () =>
        resolve({
          blob: new Blob(this.chunks, { type: "audio/webm" }),
          durationMs: performance.now() - this.startedAt,
        });
      rec.stop();
    });
  }
}

export class Player {
  private current?: HTMLAudioElement;
  private sinkId = "";

  /** Output device for future playback (empty string = system default). No-op where setSinkId is unsupported. */
  setSink(deviceId: string): void {
    this.sinkId = deviceId;
  }

  /** Play an mp3 buffer; resolves when playback ends. */
  async play(data: ArrayBuffer, onStateChange: (playing: boolean) => void): Promise<void> {
    this.stop();
    const url = URL.createObjectURL(new Blob([data], { type: "audio/mpeg" }));
    const audio = new Audio(url);
    this.current = audio;
    if (this.sinkId && "setSinkId" in audio) {
      try { await (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(this.sinkId); }
      catch { /* fall back to system default */ }
    }
    onStateChange(true);
    return new Promise((resolve) => {
      const done = () => { onStateChange(false); URL.revokeObjectURL(url); resolve(); };
      audio.onended = done;
      audio.onerror = done;
      void audio.play();
    });
  }

  stop(): void {
    this.current?.pause();
    this.current = undefined;
  }
}
