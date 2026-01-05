/**
 * Resume Versioning Module
 *
 * Manages resume version snapshots created from chat amendments.
 * Supports undo functionality by maintaining full content snapshots.
 */

export interface VersionCreateInput {
  optimizationId: string;
  sessionId: string | null;
  content: Record<string, unknown>;
  changeSummary?: string;
}

export interface VersionData {
  id: string;
  optimizationId: string;
  sessionId: string | null;
  versionNumber: number;
  content: Record<string, unknown>;
  changeSummary: string | null;
  createdAt: Date;
}

/**
 * Create new resume version snapshot
 *
 * @param input - Version creation parameters
 * @returns Created version data with auto-incremented version number
 */
export async function createVersion(
  input: VersionCreateInput
): Promise<VersionData> {
  const { createResumeVersion } = await import('../supabase/resume-versions');

  const version = await createResumeVersion({
    optimization_id: input.optimizationId,
    session_id: input.sessionId,
    content: input.content,
    change_summary: input.changeSummary ?? null,
  });

  return {
    id: version.id,
    optimizationId: version.optimization_id,
    sessionId: version.session_id,
    versionNumber: version.version_number,
    content: version.content,
    changeSummary: version.change_summary,
    createdAt: new Date(version.created_at),
  };
}

/**
 * Get specific resume version
 *
 * @param versionId - Version ID to retrieve
 * @returns Version data
 */
export async function getVersion(versionId: string): Promise<VersionData> {
  const { getResumeVersion } = await import('../supabase/resume-versions');

  const version = await getResumeVersion(versionId);

  if (!version) {
    throw new Error(`Version ${versionId} not found`);
  }

  return {
    id: version.id,
    optimizationId: version.optimization_id,
    sessionId: version.session_id,
    versionNumber: version.version_number,
    content: version.content,
    changeSummary: version.change_summary,
    createdAt: new Date(version.created_at),
  };
}

/**
 * Get latest version for optimization
 */
export async function getLatestVersion(
  optimizationId: string
): Promise<VersionData | null> {
  const { getLatestVersion: getLatest } = await import('../supabase/resume-versions');

  const version = await getLatest(optimizationId);

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    optimizationId: version.optimization_id,
    sessionId: version.session_id,
    versionNumber: version.version_number,
    content: version.content,
    changeSummary: version.change_summary,
    createdAt: new Date(version.created_at),
  };
}

/**
 * Undo to previous version (creates new version with previous content)
 *
 * @param currentVersionId - Current version to undo from
 * @returns New version data pointing to previous content
 */
export async function undoVersion(
  currentVersionId: string
): Promise<VersionData> {
  const { getResumeVersion, getVersionByNumber, createResumeVersion } = await import('../supabase/resume-versions');

  const currentVersion = await getResumeVersion(currentVersionId);

  if (!currentVersion) {
    throw new Error(`Version ${currentVersionId} not found`);
  }

  if (currentVersion.version_number === 1) {
    throw new Error('Cannot undo version 1 (original version)');
  }

  // Get previous version
  const previousVersion = await getVersionByNumber(
    currentVersion.optimization_id,
    currentVersion.version_number - 1
  );

  if (!previousVersion) {
    throw new Error('Previous version not found');
  }

  // Create new version with previous content
  const undoVersion = await createResumeVersion({
    optimization_id: currentVersion.optimization_id,
    session_id: currentVersion.session_id,
    content: previousVersion.content,
    change_summary: `Undo: reverted to version ${previousVersion.version_number}`,
  });

  return {
    id: undoVersion.id,
    optimizationId: undoVersion.optimization_id,
    sessionId: undoVersion.session_id,
    versionNumber: undoVersion.version_number,
    content: undoVersion.content,
    changeSummary: undoVersion.change_summary,
    createdAt: new Date(undoVersion.created_at),
  };
}

/**
 * Get version history for optimization
 */
export async function getVersionHistory(
  optimizationId: string
): Promise<VersionData[]> {
  const { getVersionHistory: getHistory } = await import('../supabase/resume-versions');

  const versions = await getHistory(optimizationId);

  return versions.map(v => ({
    id: v.id,
    optimizationId: v.optimization_id,
    sessionId: v.session_id,
    versionNumber: v.version_number,
    content: v.content,
    changeSummary: v.change_summary,
    createdAt: new Date(v.created_at),
  }));
}
