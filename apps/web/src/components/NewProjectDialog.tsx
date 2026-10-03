import type { Project } from "@mesh/server/api";
import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { isGithubUrl } from "../projects";

interface Props {
  workspace: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

const TITLE_MAX = 80;

export function NewProjectDialog({ workspace, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    const url = link.trim();
    if (busy) return;
    if (!name) return setError("Give the project a title");
    if (url && !isGithubUrl(url)) return setError("The GitHub link must look like https://github.com/owner/repo");
    setBusy(true);
    setError("");
    try {
      const project = await api.createProject(workspace, { title: name, ...(url ? { github_url: url } : {}) });
      onCreated(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project");
      setBusy(false);
    }
  };

  return (
    <div className="backdrop palette-wrap" data-modal onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-label="New project" onSubmit={submit} noValidate>
        <header className="dialog-head">
          <h2>New project</h2>
          <button type="button" className="icon-btn dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <label className="field">
          <span>Title</span>
          <input autoFocus required maxLength={TITLE_MAX} value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="Billing Service" />
        </label>
        <label className="field">
          <span>GitHub link <em>optional</em></span>
          <input type="url" inputMode="url" spellCheck={false} value={link} onChange={(e) => { setLink(e.target.value); setError(""); }} placeholder="https://github.com/owner/repo" />
        </label>
        <p className="muted small">Sessions from this repository show up under the project.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <footer className="dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>{busy ? "Creating…" : "Create project"}</button>
        </footer>
      </form>
    </div>
  );
}
