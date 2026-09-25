export type JobStatus = 
  | 'PENDING' 
  | 'RENDERING' 
  | 'READY' 
  | 'OPENING_INSTAGRAM' 
  | 'WAITING_FOR_USER' 
  | 'POSTING' 
  | 'PUBLISHED' 
  | 'FAILED' 
  | 'NEEDS_USER_ACTION';

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  repoPath: string;
  techStack: string[];
  createdAt: string;
  lastVideoPath?: string;
  lastVideoHash?: string;
  status: 'IDLE' | 'READY' | 'PUBLISHED';
}

export interface JobItem {
  id: string;
  projectId: string;
  projectName: string;
  videoPath: string;
  videoHash: string;
  caption: string;
  hashtags: string[];
  creationTime: string;
  postingAttempt: number;
  status: JobStatus;
  result?: string;
  errorMessage?: string;
  screenshot?: string;
  dryRun: boolean;
  historyLog: string[];
}

export interface WorkflowConfig {
  dryRun: boolean;
  postEnabled: boolean;
  postNow: boolean;
  firstLiveTestConfirm: boolean;
  postTime: string;
  timezone: string;
  postOrder: 'oldest-first' | 'newest-first';
  targetAspect: string;
  minDuration: number;
  maxDuration: number;
  videoCodec: string;
  audioCodec: string;
  projectsDir: string;
  outputDir: string;
  archiveDir: string;
  failedDir: string;
  logsDir: string;
  stopOnLogin: boolean;
  stopOnCaptcha: boolean;
  stopOnMissingElement: boolean;
  screenshotOnFail: boolean;
}

export interface VideoValidationResult {
  status: 'VALID' | 'INVALID';
  valid: boolean;
  details: {
    duration: number;
    videoCodec: string;
    audioCodec: string;
    dimensions: string;
    isVertical: boolean;
    sha256: string;
  };
  errors: string[];
}

export interface CaptionGenerationResult {
  caption: string;
  hook: string;
  body: string;
  hashtags: string[];
  source: string;
  safetyChecked: boolean;
}
