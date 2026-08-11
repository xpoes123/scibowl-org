import { useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

// LeBot's /upload endpoint validates, saves to the VPS, and pings Sage. CORS is open there.
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL ?? "https://lebot.djiang.xyz/upload";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function PacketSubmitPage() {
  const [tournament, setTournament] = useState("");
  const [submitter, setSubmitter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const canSubmit = tournament.trim().length > 0 && file !== null && status.kind !== "submitting";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tournament.trim() || !file) return;
    setStatus({ kind: "submitting" });

    const body = new FormData();
    body.append("tournament", tournament.trim());
    body.append("submitter", submitter.trim());
    body.append("file", file);

    try {
      const res = await fetch(UPLOAD_URL, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok) {
        setStatus({ kind: "success", message: data.message ?? "Uploaded — thanks!" });
        setTournament("");
        setSubmitter("");
        setFile(null);
        event.currentTarget.reset();
      } else {
        setStatus({ kind: "error", message: data.error ?? "Upload failed. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Please try again." });
    }
  };

  return (
    <div className="sbStack">
      <div className="card sbTournamentCard sbHeroCard">
        <Link to="/packets" className="sbInlineLink">
          <ArrowLeftIcon className="sbIcon" aria-hidden="true" /> Back to packets
        </Link>
        <h1 className="sbHeroTitle sbHeroTitleTight">Submit a packet</h1>
        <p className="sbMuted sbTopSpace">
          Share an invitational set with the community. PDF or DOCX, up to 30&nbsp;MB. Submissions are
          reviewed before they appear.
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <label className="sbField">
          <span className="sbFieldLabel">Tournament name *</span>
          <input
            className="sbInput"
            value={tournament}
            onChange={(e) => setTournament(e.target.value)}
            placeholder="e.g. AVES 2025"
            required
          />
        </label>

        <label className="sbField sbTopSpace">
          <span className="sbFieldLabel">Your name (optional)</span>
          <input
            className="sbInput"
            value={submitter}
            onChange={(e) => setSubmitter(e.target.value)}
            placeholder="so we can credit you"
          />
        </label>

        <label className="sbField sbTopSpace">
          <span className="sbFieldLabel">Packet file *</span>
          <input
            className="sbInput"
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>

        <button type="submit" className="sbPageButton sbTopSpace" disabled={!canSubmit}>
          {status.kind === "submitting" ? "Uploading…" : "Upload packet"}
        </button>

        {status.kind === "success" && (
          <p className="sbMuted sbTopSpace" role="status">
            ✓ {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p className="sbTopSpace sbError" role="alert">
            {status.message}
          </p>
        )}
      </form>
    </div>
  );
}
