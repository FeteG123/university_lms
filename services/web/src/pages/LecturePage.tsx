import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiGet, wsLectureUrl, type LectureMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";

export function LecturePage() {
  const courseId = usePositiveIntParam("courseId");
  if (!courseId) {
    return <Navigate to="/" replace />;
  }
  return <LecturePageContent courseId={courseId} />;
}

function LecturePageContent({ courseId }: { courseId: number }) {
  const { token } = useAuth();
  const [lines, setLines] = useState<LectureMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [err, setErr] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const history = await apiGet<LectureMessage[]>(`/courses/${courseId}/lecture/messages`);
        if (!cancelled) {
          setLines(history);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load chat history");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const url = wsLectureUrl(courseId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("Connecting…");
    ws.onopen = () => setStatus("Connected");
    ws.onclose = () => {
      setStatus("Disconnected");
      wsRef.current = null;
    };
    ws.onerror = () => setStatus("Error");
    ws.onmessage = (ev) => {
      try {
        const j = JSON.parse(ev.data as string) as LectureMessage;
        if (j.user && j.text) {
          setLines((prev) => {
            if (j.id != null && prev.some((m) => m.id === j.id)) {
              return prev;
            }
            return [...prev.slice(-199), j];
          });
        }
      } catch {
        setLines((prev) => [...prev.slice(-199), { id: -Date.now(), user: "?", text: String(ev.data), sent_at: "" }]);
      }
    };
    return () => {
      ws.close();
    };
  }, [courseId, token]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t) {
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErr("Chat is not connected. Wait for Connected status or refresh the page.");
      return;
    }
    setErr(null);
    wsRef.current.send(t);
    setInput("");
  }

  return (
    <div className="page-stack">
      {err ? <p className="err">{err}</p> : null}
      <div className="card">
        <h2>Live lecture — course {courseId}</h2>
        <p className="card-lead">
          Real-time classroom chat.{" "}
          <span className={status === "Connected" ? "status-badge status-badge--live" : "status-badge"}>
            {status}
          </span>
        </p>
      </div>
      <div className="card">
        <h2>Room chat</h2>
        <div className="chat">
          <div className="chat-log" ref={logRef}>
            {lines.length === 0 ? <p className="muted">No messages yet.</p> : null}
            {lines.map((ln) => (
              <div key={ln.id ?? `${ln.sent_at}-${ln.user}-${ln.text}`} className="chat-msg">
                <b>{ln.user}</b>: {ln.text}
              </div>
            ))}
          </div>
          <form className="chat-input" onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type and press Enter…" />
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          </form>
        </div>
      </div>
      <Link to={`/courses/${courseId}`} className="back-link">
        ← Back to course
      </Link>
    </div>
  );
}
