import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PCMRecorder } from "@speechmatics/browser-audio-input";
import workletUrl from "@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url";

// Backend Speechmatics WebSocket. The server reads `lang`/`language` from the
// query string and resolves the waiter (and their enrolled voice signature)
// itself, so we only need to pass the language here.
const WS_URL =
  import.meta.env.VITE_SPEECHMATICS_WS_URL || "ws://localhost:4000/ws/speechmatics";
const WORKLET_URL = workletUrl;
const RECORDING_SAMPLE_RATE = 16000;

// Speechmatics labels the enrolled waiter as "WAITER"; everyone else is a customer.
const roleOf = (speaker) => (speaker === "WAITER" ? "waiter" : "customer");
const labelOf = (speaker) => (speaker === "WAITER" ? "Waiter" : "Customer");

function Bubble({ speaker, text, partial = false }) {
  const role = roleOf(speaker);
  return (
    <div className={`conv-row conv-row--${role}`}>
      <div className={`conv-avatar conv-avatar--${role}`}>{role === "waiter" ? "W" : "C"}</div>
      <div className={`conv-bubble conv-bubble--${role}${partial ? " conv-bubble--partial" : ""}`}>
        <span className="conv-bubble-name">{labelOf(speaker)}</span>
        <span className="conv-bubble-text">
          {text}
          {partial && <span className="conv-caret" />}
        </span>
      </div>
    </div>
  );
}

// Group a Speechmatics `results` array into contiguous { speaker, text } segments.
function segmentsFromResults(results = []) {
  const segments = [];
  for (const result of results) {
    const alt = result?.alternatives?.[0];
    if (!alt) continue;
    const content = alt.content ?? "";
    const speaker = alt.speaker ?? "UNKNOWN";
    const isPunctuation = result.type === "punctuation";
    const last = segments[segments.length - 1];
    if (last && last.speaker === speaker) {
      last.text += (isPunctuation ? "" : " ") + content;
    } else {
      segments.push({ speaker, text: content });
    }
  }
  return segments;
}

// Float32 [-1, 1] → 16-bit signed PCM (little-endian). Matches the format the
// backend forwards to Speechmatics: raw pcm_s16le @ 16 kHz mono.
function convertFloatTo16BitPCM(input) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function Conversation() {
  const [status, setStatus] = useState("idle"); // idle | recording | paused | ended
  const [messages, setMessages] = useState([]); // finalized { speaker, text }
  const [partial, setPartial] = useState([]); // live, not-yet-final segments
  const [error, setError] = useState("");

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const pausedRef = useRef(false);
  const endedByUserRef = useRef(false);
  const scrollRef = useRef(null);

  // Auto-scroll to the latest line.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, partial]);

  // Tear everything down on unmount.
  useEffect(() => () => teardown(), []);

  function appendFinal(segments) {
    if (segments.length === 0) return;
    console.log(segments,"??");
    
    setMessages((prev) => {
      const merged = [...prev];
      for (const seg of segments) {
        const last = merged[merged.length - 1];
        if (last && last.speaker === seg.speaker) {
          merged[merged.length - 1] = { ...last, text: `${last.text} ${seg.text}`.trim() };
        } else {
          merged.push(seg);
        }
      }
      return merged;
    });
  }

  function handleMessage(data) {
    let msg;
    try {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      msg = JSON.parse(text);
    } catch {
      return;
    }

    switch (msg.message) {
      case "AddTranscript":
        appendFinal(segmentsFromResults(msg.results));
        setPartial([]);
        break;
      case "AddPartialTranscript":
        setPartial(segmentsFromResults(msg.results));
        break;
      case "SpeechmaticsError":
        setError(msg.humanized_message || "Transcription service error.");
        break;
      case "SpeechmaticsDisconnected":
        setError("Transcription service disconnected.");
        break;
      default:
        break;
    }
  }

  async function handleStart() {
    setError("");
    setMessages([]);
    setPartial([]);
    pausedRef.current = false;
    endedByUserRef.current = false;

    try {
      const ws = new WebSocket(`${WS_URL}?lang=en`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        try {
          const audioContext = new AudioContext({ sampleRate: RECORDING_SAMPLE_RATE });
          audioCtxRef.current = audioContext;

          const recorder = new PCMRecorder(WORKLET_URL);
          recorderRef.current = recorder;

          recorder.addEventListener("audio", (event) => {
            if (pausedRef.current) return;
            const socket = wsRef.current;
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(convertFloatTo16BitPCM(event.data));
            }
          });

          await recorder.startRecording({ audioContext });
          setStatus("recording");
        } catch (err) {
          setError(err?.message || "Microphone access was denied.");
          teardown();
          setStatus("ended");
        }
      };
      ws.onmessage = (event) => handleMessage(event.data);
      ws.onerror = () => setError("Unable to connect to the transcription service.");
      ws.onclose = () => {
        if (!endedByUserRef.current) setStatus("ended");
      };
    } catch (err) {
      setError(err?.message || "Could not start the session.");
      teardown();
    }
  }

  function handlePause() {
    pausedRef.current = true;
    recorderRef.current?.mute?.();
    setStatus("paused");
  }

  function handleResume() {
    pausedRef.current = false;
    recorderRef.current?.unmute?.();
    setStatus("recording");
  }

  function teardown() {
    pausedRef.current = true;

    if (recorderRef.current) {
      recorderRef.current.stopRecording();
      recorderRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;

    // Closing the client socket makes the backend flush EndOfStream to Speechmatics.
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
  }

  function handleEnd() {
    endedByUserRef.current = true;
    teardown();
    setPartial([]);
    setStatus("ended");
  }

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isLive = isRecording || isPaused;

  return (
    <div className="conv-page">
      <Link to="/" className="conv-back">
        ← Back to Home
      </Link>

      <header className="conv-card conv-header">
        <div>
          <h1 className="conv-title">Live Conversation</h1>
          <p className="conv-subtitle">Real-time waiter &amp; customer transcription</p>
        </div>
        <span className={`conv-status conv-status--${status}`}>
          <span className="conv-status-dot" />
          {status}
        </span>
      </header>

      <div className="conv-card conv-controls">
        <button className="conv-btn conv-btn--start" onClick={handleStart} disabled={isLive}>
          <span aria-hidden="true">🎙</span>
          {status === "ended" ? "Restart" : "Start"}
        </button>
        {isPaused ? (
          <button className="conv-btn conv-btn--resume" onClick={handleResume}>
            <span aria-hidden="true">▶</span>
            Resume
          </button>
        ) : (
          <button className="conv-btn conv-btn--pause" onClick={handlePause} disabled={!isRecording}>
            <span aria-hidden="true">⏸</span>
            Pause
          </button>
        )}
        <button className="conv-btn conv-btn--end" onClick={handleEnd} disabled={!isLive}>
          <span aria-hidden="true">⏹</span>
          End
        </button>
      </div>

      {error && (
        <div className="conv-error">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <section className="conv-card conv-feed">
        <div className="conv-feed-head">
          <h2 className="conv-feed-title">Conversation</h2>
          <div className="conv-feed-meta">
            {isRecording && (
              <span className="conv-live">
                <span className="conv-live-dot" />
                LIVE
              </span>
            )}
            {isPaused && <span className="conv-paused-tag">PAUSED</span>}
            <span className="conv-count">
              {messages.length} {messages.length === 1 ? "segment" : "segments"}
            </span>
          </div>
        </div>

        <div className="conv-feed-body" ref={scrollRef}>
          {messages.length === 0 && partial.length === 0 && (
            <div className="conv-empty">
              <div className="conv-empty-icon">💬</div>
              <p className="conv-empty-title">{isLive ? "Listening…" : "No conversation yet"}</p>
              <p className="conv-empty-sub">
                {isLive
                  ? "Start speaking — transcription will appear here."
                  : "Press Start to begin the live conversation."}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} speaker={m.speaker} text={m.text} />
          ))}

          {partial.map((m, i) => (
            <Bubble key={`p-${i}`} speaker={m.speaker} text={m.text} partial />
          ))}
        </div>
      </section>
    </div>
  );
}

export default Conversation;
