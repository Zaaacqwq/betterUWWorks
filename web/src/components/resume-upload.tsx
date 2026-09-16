"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useResume, type ResumeSummary } from "@/hooks/use-resume";
import type { Capability, EvidenceType, UserInfo } from "@/lib/resume/types";
import { normalizeSkill } from "@/lib/resume/skill-utils";
import { SkillPick } from "./skill-pick";
import { MAX_RESUMES } from "@/lib/line-check/types";

interface ResumeUploadProps {
  open: boolean;
  onClose: () => void;
  /** Reopen the dialog, from the notice shown when a reading finishes. */
  onOpen: () => void;
}

// Shown once the dialog is closed and the reading it started has finished.
type Notice = { ok: true } | { ok: false; message: string };
const NOTICE_MS = 12000;

type InputMode = "file" | "text";

const ACCEPT = ".pdf,.doc,.docx,.txt,.md";

export function ResumeUpload({ open, onClose, onOpen }: ResumeUploadProps) {
  const {
    resumeText, profile, meta, userInfo, extraSkills, hasResume,
    resumes, activeResumeId,
    setResume, setProfile, setUserInfo, setExtraSkills, clearResume,
    startNewResume, switchResume, renameResume, removeResume,
  } = useResume();
  // Uploading one to keep alongside the others rather than over the one in use.
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<InputMode>("file");
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // The dialog stays mounted while closed, so a reading carries on after the
  // student closes it to browse; this says whether anyone is watching.
  const openRef = useRef(open);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/resume/parse", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      setResume(json.data.text, json.data.fileName);
      await extractProfile(json.data.text);
    } catch {
      setError("Failed to upload file");
    } finally {
      setParsing(false);
    }
  }, [setResume]);

  const handleTextSubmit = useCallback(async () => {
    if (textInput.trim().length < 50) {
      setError("Resume text is too short (min 50 characters)");
      return;
    }
    setResume(textInput.trim());
    await extractProfile(textInput.trim());
  }, [textInput, setResume]);

  const extractProfile = async (text: string) => {
    setExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/resume/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
        setAdding(false);
        if (!openRef.current) setNotice({ ok: true });
      } else {
        setError(json.error ?? "Failed to analyze resume");
        if (!openRef.current) setNotice({ ok: false, message: json.error ?? "Couldn't read your resume." });
      }
    } catch {
      setError("Failed to analyze resume");
      if (!openRef.current) setNotice({ ok: false, message: "Couldn't reach the server to read your resume." });
    } finally {
      setExtracting(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClear = useCallback(() => {
    clearResume();
    setTextInput("");
    setError("");
    setAdding(false);
  }, [clearResume]);

  // The upload that follows is kept as another resume, and put in use.
  const handleAddAnother = useCallback(() => {
    startNewResume();
    setAdding(true);
    setMode("file");
    setError("");
  }, [startNewResume]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return notice ? (
      <ResumeNotice
        notice={notice}
        onView={() => {
          setNotice(null);
          onOpen();
        }}
        onDismiss={() => setNotice(null)}
      />
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-dialog-title"
        className="bg-canvas rounded-xl border border-hairline shadow-[var(--shadow-pop)] w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-hairline-soft">
          <h2 id="resume-dialog-title" className="text-[15px] font-semibold text-ink">Resume</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-stone hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {resumes.length > 0 && (
            <ResumeList
              resumes={resumes}
              activeId={activeResumeId}
              busy={parsing || extracting}
              adding={adding}
              onUse={switchResume}
              onRename={renameResume}
              onRemove={removeResume}
              onAdd={handleAddAnother}
              onCancelAdd={() => setAdding(false)}
            />
          )}
          <AiNotice />
          {hasResume && profile && !adding ? (
            <ProfileView
              // Remounted when another resume comes into use, so the details
              // and skills below belong to that one.
              key={activeResumeId ?? "resume"}
              profile={profile}
              meta={meta}
              userInfo={userInfo}
              extraSkills={extraSkills}
              onClear={handleClear}
              onReextract={() => resumeText && extractProfile(resumeText)}
              onSaveUserInfo={setUserInfo}
              onUpdateExtraSkills={setExtraSkills}
              extracting={extracting}
            />
          ) : (
            <>
              <div className="flex gap-1 bg-surface rounded-lg p-0.5">
                <TabBtn active={mode === "file"} onClick={() => setMode("file")}>Upload File</TabBtn>
                <TabBtn active={mode === "text"} onClick={() => setMode("text")}>Paste Text</TabBtn>
              </div>

              {mode === "file" ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-[10px] p-8 text-center cursor-pointer transition-colors ${
                    dragOver ? "border-primary bg-primary/5" : "border-hairline hover:border-primary/40"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                  <svg className="w-10 h-10 text-stone mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-charcoal font-medium">
                    {parsing ? "Parsing..." : "Drop file here or click to upload"}
                  </p>
                  <p className="text-xs text-stone mt-1">PDF, DOC, DOCX, TXT (max 5MB)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your resume text here..."
                    rows={10}
                    className="w-full px-3 py-2.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal resize-none focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleTextSubmit}
                    disabled={textInput.trim().length < 50}
                    className="w-full py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary-pressed disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {extracting ? "Analyzing..." : "Submit"}
                  </button>
                </div>
              )}

              {(parsing || extracting) && (
                <div className="rounded-lg bg-primary-tint px-3.5 py-3 space-y-1" role="status" aria-live="polite">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-primary-deep">
                    <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                    {parsing ? "Reading the file…" : "Reading your resume with AI…"}
                  </p>
                  <p className="text-xs text-slate leading-relaxed">
                    This usually takes under a minute. You can close this and browse jobs in the meantime — we&apos;ll let
                    you know when it&apos;s ready.
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// The student's resumes, one of them in use. Only the one in use is scored and
// checked against the postings; the others keep the checks made while they
// were, so going back to one shows its scores at once.
// What happens to a resume here, said before it is uploaded rather than only
// on the privacy page.
function AiNotice() {
  return (
    <p className="text-[11.5px] leading-relaxed text-stone">
      Your resume is read by an AI model to list your skills, and its text is kept on this server under your email so
      every posting can be checked against it. It is never shown to other students, and removing it deletes the copy
      here.{" "}
      <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
        Privacy
      </a>
    </p>
  );
}

function ResumeList({
  resumes,
  activeId,
  busy,
  adding,
  onUse,
  onRename,
  onRemove,
  onAdd,
  onCancelAdd,
}: {
  resumes: ResumeSummary[];
  activeId: string | null;
  busy: boolean;
  adding: boolean;
  onUse: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onCancelAdd: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);

  const use = (id: string) => {
    setSwitching(id);
    onUse(id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-slate">Your resumes ({resumes.length} of {MAX_RESUMES})</p>
        {adding ? (
          <button onClick={onCancelAdd} className="text-xs text-steel hover:text-charcoal">
            Cancel
          </button>
        ) : (
          resumes.length < MAX_RESUMES && (
            <button onClick={onAdd} disabled={busy} className="text-xs font-medium text-primary hover:underline disabled:opacity-40">
              Add another
            </button>
          )
        )}
      </div>

      <ul className="divide-y divide-hairline-soft border border-hairline rounded-lg">
        {resumes.map((r) => {
          const inUse = r.id === activeId;
          return (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                {renaming === r.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      if (draft.trim()) onRename(r.id, draft.trim());
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    maxLength={80}
                    className="w-full h-7 px-2 rounded border border-primary/40 text-[13px] text-ink bg-canvas focus:outline-none"
                  />
                ) : (
                  <p className="text-[13px] text-ink truncate">
                    {r.label ?? r.fileName ?? "Resume"}
                    {inUse && <span className="ml-2 text-[10.5px] font-semibold text-good bg-good/10 px-1.5 py-0.5 rounded-full">In use</span>}
                  </p>
                )}
                <p className="text-[11px] text-stone">
                  {r.checked > 0 ? `${r.checked.toLocaleString()} postings checked` : "not checked yet"} ·{" "}
                  {new Date(r.updatedAt).toLocaleDateString()}
                </p>
              </div>
              {!inUse && (
                <button
                  onClick={() => use(r.id)}
                  disabled={switching !== null}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-40 shrink-0"
                >
                  {switching === r.id ? "Switching…" : "Use"}
                </button>
              )}
              <button
                onClick={() => {
                  setDraft(r.label ?? r.fileName ?? "");
                  setRenaming(r.id);
                }}
                className="text-xs text-steel hover:text-charcoal shrink-0"
              >
                Rename
              </button>
              {resumes.length > 1 && (
                <button onClick={() => onRemove(r.id)} className="text-xs text-error/80 hover:text-error shrink-0">
                  Delete
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {adding && <p className="text-[11.5px] text-slate">Upload the resume to keep alongside the others — it goes into use once it&apos;s read.</p>}
    </div>
  );
}

function ProfileView({
  profile,
  meta,
  userInfo,
  extraSkills,
  onClear,
  onReextract,
  onSaveUserInfo,
  onUpdateExtraSkills,
  extracting,
}: {
  profile: NonNullable<ReturnType<typeof useResume>["profile"]>;
  meta: ReturnType<typeof useResume>["meta"];
  userInfo: UserInfo | null;
  extraSkills: string[];
  onClear: () => void;
  onReextract: () => void;
  onSaveUserInfo: (info: UserInfo) => void;
  onUpdateExtraSkills: (skills: string[]) => void;
  extracting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{meta?.fileName ?? "Pasted text"}</p>
          <p className="text-xs text-stone mt-0.5">{profile.summary}</p>
        </div>
        <span className="text-[11px] font-semibold text-good bg-good/10 px-2 py-0.5 rounded-full shrink-0">
          Analyzed
        </span>
      </div>

      {profile.capabilities && profile.capabilities.length > 0 ? (
        <CapabilitiesView capabilities={profile.capabilities} />
      ) : (
        <div>
          <p className="text-xs font-semibold text-slate mb-1.5">Skills ({profile.skills.length})</p>
          <div className="flex flex-wrap gap-1">
            {profile.skills.map((s) => (
              <span
                key={s.name}
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  s.proficiency === "advanced"
                    ? "bg-primary/10 text-primary"
                    : s.proficiency === "intermediate"
                      ? "bg-card-tint-lavender text-primary-deep"
                      : "bg-surface text-slate"
                }`}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <ExtraSkillsEditor
        skills={extraSkills}
        profileSkillNames={profile.skills.map((s) => normalizeSkill(s.name))}
        onChange={onUpdateExtraSkills}
      />

      {profile.education.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate mb-1.5">Education</p>
          {profile.education.map((e, i) => (
            <p key={i} className="text-xs text-charcoal">
              {e.program} — {e.institution} (Year {e.yearLevel})
            </p>
          ))}
        </div>
      )}

      {profile.experience.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate mb-1.5">Experience ({profile.coopTermCount} co-op terms)</p>
          <div className="space-y-1">
            {profile.experience.map((e, i) => (
              <p key={i} className="text-xs text-charcoal">
                {e.title} @ {e.company} ({e.duration})
              </p>
            ))}
          </div>
        </div>
      )}

      <UserInfoForm userInfo={userInfo} onSave={onSaveUserInfo} />

      <div className="flex gap-2 pt-2 border-t border-hairline">
        <button
          onClick={onReextract}
          disabled={extracting}
          className="flex-1 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 disabled:opacity-40 transition-colors"
        >
          {extracting ? "Re-analyzing..." : "Re-analyze"}
        </button>
        <button
          onClick={onClear}
          className="flex-1 py-2 text-xs font-medium text-error border border-error/30 rounded-lg hover:bg-error/5 transition-colors"
        >
          Remove Resume
        </button>
      </div>
    </div>
  );
}

function UserInfoForm({
  userInfo,
  onSave,
}: {
  userInfo: UserInfo | null;
  onSave: (info: UserInfo) => void;
}) {
  const [coopTerm, setCoopTerm] = useState(userInfo?.coopTermNumber ?? 1);
  const [gpa, setGpa] = useState(userInfo?.gpa?.toString() ?? "");
  const [program, setProgram] = useState(userInfo?.program ?? "");
  const [yearLevel, setYearLevel] = useState(userInfo?.yearLevel?.toString() ?? "");
  const [citizen, setCitizen] = useState(toAnswer(userInfo?.citizenOrPermanentResident));
  const [licence, setLicence] = useState(toAnswer(userInfo?.hasDriversLicence));

  const handleSave = () => {
    onSave({
      coopTermNumber: coopTerm,
      gpa: gpa ? parseFloat(gpa) : null,
      program: program.trim(),
      yearLevel: yearLevel ? parseInt(yearLevel, 10) : null,
      citizenOrPermanentResident: fromAnswer(citizen),
      hasDriversLicence: fromAnswer(licence),
    });
  };

  const hasChanges =
    coopTerm !== (userInfo?.coopTermNumber ?? 1) ||
    gpa !== (userInfo?.gpa?.toString() ?? "") ||
    program !== (userInfo?.program ?? "") ||
    yearLevel !== (userInfo?.yearLevel?.toString() ?? "") ||
    citizen !== toAnswer(userInfo?.citizenOrPermanentResident) ||
    licence !== toAnswer(userInfo?.hasDriversLicence);

  return (
    <div className="space-y-3 pt-3 border-t border-hairline">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate">Your Details</p>
        {userInfo && !hasChanges && (
          <span className="text-[10px] font-semibold text-good bg-good/10 px-1.5 py-0.5 rounded-full">
            Saved
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-stone block mb-1">Co-op Term #</label>
          <select
            value={coopTerm}
            onChange={(e) => setCoopTerm(parseInt(e.target.value, 10))}
            className="w-full px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal focus:outline-none focus:border-primary"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>Term {n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone block mb-1">Year Level</label>
          <select
            value={yearLevel}
            onChange={(e) => setYearLevel(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal focus:outline-none focus:border-primary"
          >
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>Year {n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone block mb-1">Program</label>
          <input
            type="text"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            placeholder="e.g. Computer Science"
            className="w-full px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[11px] text-stone block mb-1">GPA (optional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={gpa}
            onChange={(e) => setGpa(e.target.value)}
            placeholder="e.g. 85"
            className="w-full px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal focus:outline-none focus:border-primary"
          />
        </div>
        <AnswerField label="Canadian citizen or PR" value={citizen} onChange={setCitizen} />
        <AnswerField label="Driver's licence" value={licence} onChange={setLicence} />
      </div>
      <p className="text-[11px] text-stone">
        Only used here, to warn you about postings you can&apos;t take. Left unset, those requirements are still shown on each posting.
      </p>
      <button
        onClick={handleSave}
        disabled={!hasChanges && userInfo != null}
        className="w-full py-2 text-xs font-semibold text-on-primary bg-primary rounded-lg hover:bg-primary-pressed disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {userInfo ? "Update Details" : "Save Details"}
      </button>
    </div>
  );
}

const EVIDENCE_GROUPS: { type: EvidenceType; label: string }[] = [
  { type: "work_used", label: "Used in Work" },
  { type: "project_used", label: "Used in Projects" },
  { type: "explicit", label: "Skills Section Only" },
  { type: "inferred", label: "Suggested — click one to confirm it; it counts once you do" },
  { type: "weak_inferred", label: "Loosely suggested — click one to confirm it" },
];

const EVIDENCE_STYLE: Record<EvidenceType, string> = {
  work_used: "bg-primary/10 text-primary",
  project_used: "bg-card-tint-lavender text-primary-deep",
  explicit: "bg-surface text-slate",
  inferred: "bg-brand-orange/10 text-brand-orange",
  weak_inferred: "bg-surface text-stone",
};

function CapabilitiesView({ capabilities }: { capabilities: Capability[] }) {
  const grouped = new Map<EvidenceType, Capability[]>();
  for (const cap of capabilities) {
    const group = grouped.get(cap.evidenceType) ?? [];
    group.push(cap);
    grouped.set(cap.evidenceType, group);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate">Capabilities ({capabilities.length})</p>
      {EVIDENCE_GROUPS.map(({ type, label }) => {
        const caps = grouped.get(type);
        if (!caps?.length) return null;
        return (
          <div key={type}>
            <p className="text-[10px] text-stone mb-1">{label} ({caps.length})</p>
            <div className="flex flex-wrap gap-1">
              {caps.map((c) => (
                <SkillPick
                  key={`${c.name}-${c.evidenceSource}`}
                  name={c.name}
                  showCheck={false}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${EVIDENCE_STYLE[c.evidenceType]}`}
                  title={`${c.evidenceSource}\n${c.reasoning}\nConfidence: ${Math.round(c.confidence * 100)}% — click to say how well you know it`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExtraSkillsEditor({
  skills,
  profileSkillNames,
  onChange,
}: {
  skills: string[];
  profileSkillNames: string[];
  onChange: (skills: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addSkill = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const normalized = normalizeSkill(trimmed);
    if (skills.some((s) => normalizeSkill(s) === normalized)) {
      setInput("");
      return;
    }
    if (profileSkillNames.includes(normalized)) {
      setInput("");
      return;
    }

    onChange([...skills, trimmed]);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="space-y-2 pt-3 border-t border-hairline">
      <p className="text-xs font-semibold text-slate">Additional Skills</p>
      <p className="text-[10px] text-stone">Skills you know but aren't on your resume</p>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Docker, Figma, GraphQL"
          className="flex-1 px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal focus:outline-none focus:border-primary"
        />
        <button
          onClick={addSkill}
          disabled={!input.trim()}
          className="px-3 py-1.5 text-xs font-semibold text-on-primary bg-primary rounded-lg hover:bg-primary-pressed disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.map((s, i) => (
            <SkillPick
              key={`${s}-${i}`}
              name={s}
              showCheck={false}
              className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-brand-orange/10 text-brand-orange"
              title="Click to change how well you know it, or remove it"
            />
          ))}
        </div>
      )}
      <p className="text-[10px] text-stone">Click any skill — here or on a posting — to say how well you know it. Skills you know only a little count for half in matching.</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
        active ? "bg-canvas text-ink shadow-sm" : "text-stone hover:text-charcoal"
      }`}
    >
      {children}
    </button>
  );
}

// A yes/no the student may leave unanswered, which is different from "no".
type Answer = "" | "yes" | "no";

function toAnswer(value: boolean | null | undefined): Answer {
  return value === true ? "yes" : value === false ? "no" : "";
}

function fromAnswer(answer: Answer): boolean | null {
  return answer === "yes" ? true : answer === "no" ? false : null;
}

function AnswerField({ label, value, onChange }: { label: string; value: Answer; onChange: (v: Answer) => void }) {
  return (
    <div>
      <label className="text-[11px] text-stone block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Answer)}
        className="w-full px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-sm text-charcoal focus:outline-none focus:border-primary"
      >
        <option value="">Not set</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

function ResumeNotice({ notice, onView, onDismiss }: { notice: Notice; onView: () => void; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:w-[340px] rounded-xl border border-hairline bg-canvas shadow-[var(--shadow-pop)] px-4 py-3.5 space-y-2.5"
    >
      <div className="space-y-0.5">
        <p className={`text-[13.5px] font-semibold ${notice.ok ? "text-ink" : "text-poor"}`}>
          {notice.ok ? "Your resume is ready" : "Your resume couldn't be read"}
        </p>
        <p className="text-[12.5px] text-slate">
          {notice.ok ? "Every posting now shows how well it matches your skills." : notice.message}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onView}
          className="h-8 px-3 rounded-lg bg-primary text-on-primary text-[12.5px] font-medium hover:bg-primary-pressed transition-colors"
        >
          {notice.ok ? "View resume" : "Try again"}
        </button>
        <button
          onClick={onDismiss}
          className="h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-charcoal hover:bg-surface transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
