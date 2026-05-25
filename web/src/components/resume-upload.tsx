"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useResume } from "@/hooks/use-resume";
import type { Capability, EvidenceType, UserInfo } from "@/lib/resume/types";
import { normalizeSkill } from "@/lib/resume/skill-utils";

interface ResumeUploadProps {
  open: boolean;
  onClose: () => void;
}

type InputMode = "file" | "text";

const ACCEPT = ".pdf,.doc,.docx,.txt,.md";

export function ResumeUpload({ open, onClose }: ResumeUploadProps) {
  const { resumeText, profile, meta, userInfo, extraSkills, hasResume, setResume, setProfile, setUserInfo, setExtraSkills, clearResume } = useResume();
  const [mode, setMode] = useState<InputMode>("file");
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      } else {
        setError(json.error ?? "Failed to analyze resume");
      }
    } catch {
      setError("Failed to analyze resume");
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
  }, [clearResume]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-canvas rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-hairline">
          <h2 className="text-base font-bold text-ink">Resume</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-stone hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {hasResume && profile ? (
            <ProfileView
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
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
                    className="w-full px-3 py-2.5 border border-hairline rounded-xl bg-canvas text-sm text-charcoal resize-none focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleTextSubmit}
                    disabled={textInput.trim().length < 50}
                    className="w-full py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {extracting ? "Analyzing..." : "Submit"}
                  </button>
                </div>
              )}

              {(parsing || extracting) && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                  {parsing ? "Parsing document..." : "Analyzing resume with AI..."}
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
        <span className="text-[11px] font-bold text-brand-green bg-card-tint-mint px-2 py-0.5 rounded-full shrink-0">
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

  const handleSave = () => {
    onSave({
      coopTermNumber: coopTerm,
      gpa: gpa ? parseFloat(gpa) : null,
      program: program.trim(),
      yearLevel: yearLevel ? parseInt(yearLevel, 10) : null,
    });
  };

  const hasChanges =
    coopTerm !== (userInfo?.coopTermNumber ?? 1) ||
    gpa !== (userInfo?.gpa?.toString() ?? "") ||
    program !== (userInfo?.program ?? "") ||
    yearLevel !== (userInfo?.yearLevel?.toString() ?? "");

  return (
    <div className="space-y-3 pt-3 border-t border-hairline">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate">Your Details</p>
        {userInfo && !hasChanges && (
          <span className="text-[10px] font-medium text-brand-green bg-card-tint-mint px-1.5 py-0.5 rounded-full">
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
      </div>
      <button
        onClick={handleSave}
        disabled={!hasChanges && userInfo != null}
        className="w-full py-2 text-xs font-semibold text-on-primary bg-primary rounded-xl hover:bg-primary-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
  { type: "inferred", label: "Inferred" },
  { type: "weak_inferred", label: "Weakly Inferred" },
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
                <span
                  key={`${c.name}-${c.evidenceSource}`}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium cursor-default ${EVIDENCE_STYLE[c.evidenceType]}`}
                  style={{ opacity: 0.5 + c.confidence * 0.5 }}
                  title={`${c.evidenceSource}\n${c.reasoning}\nConfidence: ${Math.round(c.confidence * 100)}%`}
                >
                  {c.name}
                </span>
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

  const removeSkill = (idx: number) => {
    onChange(skills.filter((_, i) => i !== idx));
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
          className="px-3 py-1.5 text-xs font-semibold text-on-primary bg-primary rounded-lg hover:bg-primary-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-brand-orange/10 text-brand-orange"
            >
              {s}
              <button
                onClick={() => removeSkill(i)}
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-brand-orange/20 transition-colors"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
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
