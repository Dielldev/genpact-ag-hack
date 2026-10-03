export enum Client {
  claudeCode = "claude-code",
  codex = "codex",
  cursor = "cursor",
  gemini = "gemini",
}

export enum ReportStatus {
  inProgress = "in_progress",
  blocked = "blocked",
  done = "done",
}

export enum Visibility {
  shared = "shared",
  private = "private",
}

export enum WarningKind {
  collision = "collision",
  rediscovery = "rediscovery",
}

export enum ItemKind {
  decision = "decision",
  deadEnd = "dead_end",
  humanCorrection = "human_correction",
  blocker = "blocker",
}

export enum PersonStatus {
  active = "active",
  leaving = "leaving",
  left = "left",
}

export enum KnowledgeSource {
  exitInterview = "exit_interview",
}
