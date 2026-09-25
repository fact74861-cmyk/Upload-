/**
 * ==============================================================================
 * Freebuff Cloud Persistent Queue & Job State Manager
 * Tracks state in state/queue.json and state/published.json
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type JobStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'RENDERING'
  | 'READY'
  | 'OPENING_INSTAGRAM'
  | 'WAITING_FOR_USER'
  | 'POSTING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'NEEDS_USER_ACTION'
  | 'SKIPPED_DUPLICATE';

export interface QueueJob {
  project_id: string;
  project_name: string;
  source_repository: string;
  video_path: string;
  video_sha256: string;
  caption: string;
  hashtags: string[];
  status: JobStatus;
  created_at: string;
  attempted_at: string | null;
  published_at: string | null;
  error: string | null;
  note?: string;
  duration_seconds?: number;
}

export interface PublishedRecord {
  project_id: string;
  project_name?: string;
  video_sha256: string;
  video_path: string;
  published_at: string;
}

export class QueueManager {
  private queueFilePath: string;
  private publishedFilePath: string;
  private logPaths: {
    build: string;
    render: string;
    publish: string;
    error: string;
  };

  constructor(options?: {
    queueFilePath?: string;
    publishedFilePath?: string;
  }) {
    const baseStateDir = path.resolve(process.cwd(), 'state');
    const baseLogsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(baseStateDir)) fs.mkdirSync(baseStateDir, { recursive: true });
    if (!fs.existsSync(baseLogsDir)) fs.mkdirSync(baseLogsDir, { recursive: true });

    this.queueFilePath = options?.queueFilePath || path.join(baseStateDir, 'queue.json');
    this.publishedFilePath = options?.publishedFilePath || path.join(baseStateDir, 'published.json');
    this.logPaths = {
      build: path.join(baseLogsDir, 'build.log'),
      render: path.join(baseLogsDir, 'render.log'),
      publish: path.join(baseLogsDir, 'publish.log'),
      error: path.join(baseLogsDir, 'error.log')
    };
  }

  public logEvent(type: 'build' | 'render' | 'publish' | 'error', projectId: string, status: JobStatus, message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${projectId}] [${status}] ${message}\n`;
    try {
      const logFile = this.logPaths[type] || this.logPaths.publish;
      fs.appendFileSync(logFile, line, 'utf-8');
    } catch {
      // Ignore write errors in readonly environments
    }
  }

  public getQueue(): QueueJob[] {
    if (!fs.existsSync(this.queueFilePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.queueFilePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  public saveQueue(jobs: QueueJob[]): void {
    fs.writeFileSync(this.queueFilePath, JSON.stringify(jobs, null, 2), 'utf-8');
  }

  public getPublishedRecords(): PublishedRecord[] {
    if (!fs.existsSync(this.publishedFilePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.publishedFilePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  public isHashPublished(sha256: string): boolean {
    if (!sha256) return false;
    const records = this.getPublishedRecords();
    return records.some(r => r.video_sha256 === sha256);
  }

  public markPublished(record: PublishedRecord | QueueJob): void {
    const records = this.getPublishedRecords();
    records.unshift({
      project_id: record.project_id,
      project_name: 'project_name' in record ? record.project_name : undefined,
      video_sha256: record.video_sha256,
      video_path: record.video_path,
      published_at: 'published_at' in record && record.published_at ? record.published_at : new Date().toISOString()
    });
    fs.writeFileSync(this.publishedFilePath, JSON.stringify(records, null, 2), 'utf-8');
    this.logEvent('publish', record.project_id, 'PUBLISHED', `Registered in published.json with SHA-256 ${record.video_sha256}`);
  }

  public enqueueOrUpdateJob(job: QueueJob): void {
    const queue = this.getQueue();
    const idx = queue.findIndex(j => j.project_id === job.project_id);
    if (idx >= 0) {
      queue[idx] = job;
    } else {
      queue.push(job);
    }
    this.saveQueue(queue);
    this.logEvent('build', job.project_id, job.status, `Persistent queue entry updated`);
  }

  public computeSha256(filePathOrContent: string): string {
    if (fs.existsSync(filePathOrContent)) {
      const buffer = fs.readFileSync(filePathOrContent);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    }
    return crypto.createHash('sha256').update(filePathOrContent + Date.now()).digest('hex');
  }

  public calculateNextScheduledPost(postTime: string = '18:00', timezone: string = 'Asia/Kolkata'): {
    timeString: string;
    scheduledDate: Date;
    minutesRemaining: number;
  } {
    const [hours, minutes] = postTime.split(':').map(Number);
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hours || 18, minutes || 0, 0, 0);

    if (scheduled.getTime() <= now.getTime()) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    const diffMs = scheduled.getTime() - now.getTime();
    const minutesRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60)));

    return {
      timeString: `${postTime} (${timezone})`,
      scheduledDate: scheduled,
      minutesRemaining
    };
  }
}
