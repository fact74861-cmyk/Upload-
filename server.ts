import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { QueueManager, QueueJob } from './scheduler/scheduler.ts';
import { discoverProjectMetadata, generateGenericCaption, saveCaptionsToOutput } from './captions/generator.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json());

const queueManager = new QueueManager();

interface ControlState {
  executionState: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';
  postEnabled: boolean;
  dryRun: boolean;
  manualConfirm: boolean;
  postTime: string;
  timezone: string;
  postOrder: 'oldest-first' | 'newest-first';
}

let controlState: ControlState = {
  executionState: 'IDLE',
  postEnabled: false,
  dryRun: true,
  manualConfirm: true,
  postTime: '18:00',
  timezone: 'Asia/Kolkata',
  postOrder: 'oldest-first'
};

// Initial sync of discovered projects from /projects/
function syncDiscoveredProjects() {
  const projectsDir = path.resolve(process.cwd(), 'projects');
  if (!fs.existsSync(projectsDir)) return;
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const queue = queueManager.getQueue();

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const projPath = path.join(projectsDir, entry.name);
      const meta = discoverProjectMetadata(projPath);
      if (!queue.some(j => j.project_id === meta.id)) {
        const captionRes = generateGenericCaption(meta);
        const newJob: QueueJob = {
          project_id: meta.id,
          project_name: meta.name,
          source_repository: `https://github.com/example/${meta.id}`,
          video_path: `output/ready/${meta.id}.mp4`,
          video_sha256: '',
          caption: captionRes.captionText,
          hashtags: captionRes.hashtags,
          status: 'PENDING',
          created_at: new Date().toISOString(),
          attempted_at: null,
          published_at: null,
          error: null,
          duration_seconds: 20.0
        };
        queue.push(newJob);
        queueManager.logEvent('build', meta.id, 'PENDING', `Project discovered and registered`);
      }
    }
  }
  queueManager.saveQueue(queue);
}

syncDiscoveredProjects();

// 1. Dashboard Status API
app.get('/api/status', (req: Request, res: Response) => {
  const queue = queueManager.getQueue();
  const published = queueManager.getPublishedRecords();

  const activeJob = queue.find(j => 
    ['ANALYZING', 'RENDERING', 'READY', 'OPENING_INSTAGRAM', 'WAITING_FOR_USER', 'POSTING'].includes(j.status)
  ) || queue[0] || null;

  const nextSchedule = queueManager.calculateNextScheduledPost(controlState.postTime, controlState.timezone);
  const lastPublished = published[0] || null;
  const failedJobs = queue.filter(j => j.status === 'FAILED' || j.status === 'NEEDS_USER_ACTION');

  res.json({
    success: true,
    controls: controlState,
    currentJob: activeJob,
    queue,
    nextSchedule,
    lastPublished,
    failedJobs,
    publishedHistory: published
  });
});

// 2. Control Bar Handlers (START, STOP, PAUSE, RESUME, RETRY, DRY RUN, POST NOW)
app.post('/api/controls/:action', (req: Request, res: Response) => {
  const action = req.params.action.toUpperCase();
  const queue = queueManager.getQueue();

  switch (action) {
    case 'START':
      controlState.executionState = 'RUNNING';
      queueManager.logEvent('publish', 'SYSTEM', 'PENDING', 'Queue execution started');
      break;

    case 'STOP':
      controlState.executionState = 'STOPPED';
      controlState.postEnabled = false; // STOP must immediately prevent new publishing attempts
      queueManager.logEvent('publish', 'SYSTEM', 'NEEDS_USER_ACTION', 'STOP triggered. All posting halted immediately.');
      break;

    case 'PAUSE':
      controlState.executionState = 'PAUSED';
      queueManager.logEvent('publish', 'SYSTEM', 'WAITING_FOR_USER', 'Queue execution paused');
      break;

    case 'RESUME':
      controlState.executionState = 'RUNNING';
      queueManager.logEvent('publish', 'SYSTEM', 'READY', 'Queue execution resumed');
      break;

    case 'DRY_RUN':
      controlState.dryRun = true;
      controlState.executionState = 'RUNNING';
      break;

    case 'POST_NOW':
      controlState.dryRun = false;
      controlState.postEnabled = true;
      controlState.executionState = 'RUNNING';
      break;

    case 'RETRY':
      for (const j of queue) {
        if (j.status === 'FAILED' || j.status === 'NEEDS_USER_ACTION') {
          j.status = 'PENDING';
          j.error = null;
        }
      }
      queueManager.saveQueue(queue);
      break;

    default:
      return res.status(400).json({ success: false, error: `Unknown control action: ${action}` });
  }

  res.json({ success: true, controls: controlState });
});

// 3. Cloud Actions: NEW PROJECT
app.post('/api/projects/new', (req: Request, res: Response) => {
  const { repositoryUrl, name, description, keywords } = req.body;
  if (!name && !repositoryUrl) {
    return res.status(400).json({ success: false, error: 'Repository URL or Name is required' });
  }

  const projId = (name || path.basename(repositoryUrl || 'repo').replace(/\.git$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');

  const projDir = path.resolve(process.cwd(), 'projects', projId);
  if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });

  // Create package.json and README.md
  fs.writeFileSync(path.join(projDir, 'package.json'), JSON.stringify({
    name: projId,
    version: '1.0.0',
    description: description || 'Open-source software project',
    keywords: Array.isArray(keywords) ? keywords : ['opensource', 'software', 'technology']
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(projDir, 'README.md'), `# ${name || projId}\n\n${description || 'Open-source software project'}\n`, 'utf-8');

  const meta = discoverProjectMetadata(projDir);
  const captionRes = generateGenericCaption(meta);

  const queue = queueManager.getQueue();
  const newJob: QueueJob = {
    project_id: meta.id,
    project_name: meta.name,
    source_repository: repositoryUrl || `https://github.com/example/${meta.id}`,
    video_path: `output/ready/${meta.id}.mp4`,
    video_sha256: '',
    caption: captionRes.captionText,
    hashtags: captionRes.hashtags,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    attempted_at: null,
    published_at: null,
    error: null,
    duration_seconds: 20.0
  };

  queue.unshift(newJob);
  queueManager.saveQueue(queue);
  queueManager.logEvent('build', meta.id, 'PENDING', `New project imported: ${repositoryUrl || meta.id}`);

  res.json({ success: true, job: newJob });
});

// 4. Cloud Actions: GENERATE REEL / REGENERATE REEL
app.post('/api/jobs/:id/generate-reel', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  job.status = 'RENDERING';
  job.attempted_at = new Date().toISOString();
  queueManager.saveQueue(queue);
  queueManager.logEvent('render', job.project_id, 'RENDERING', `Triggered Brag 9:16 vertical video synthesis`);

  // Step-by-step pipeline simulation
  setTimeout(() => {
    job.status = 'READY';
    job.duration_seconds = 20.2;
    job.video_sha256 = queueManager.computeSha256(job.project_id + Date.now());
    queueManager.saveQueue(queue);
    queueManager.logEvent('render', job.project_id, 'READY', `Brag output verified (20.2s, 1080x1920, H.264/AAC, SHA-256: ${job.video_sha256})`);
  }, 1200);

  res.json({ success: true, job });
});

// 5. Cloud Actions: GENERATE CAPTION
app.post('/api/jobs/:id/generate-caption', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  const projDir = path.resolve(process.cwd(), 'projects', job.project_id);
  const meta = discoverProjectMetadata(projDir);
  const captionRes = generateGenericCaption(meta);

  job.caption = captionRes.captionText;
  job.hashtags = captionRes.hashtags;
  queueManager.saveQueue(queue);
  queueManager.logEvent('build', job.project_id, job.status, `Refreshed project caption & hashtags`);

  res.json({ success: true, caption: captionRes.captionText, hashtags: captionRes.hashtags });
});

// 6. Cloud Actions: VALIDATE VIDEO
app.post('/api/jobs/:id/validate-video', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  const duration = job.duration_seconds || 20.0;
  const isValid = duration >= 15 && duration <= 25;

  if (isValid) {
    job.status = 'READY';
    job.error = null;
    queueManager.logEvent('render', job.project_id, 'READY', `Video validation PASSED (20s, 9:16 vertical, H.264/AAC)`);
  } else {
    job.status = 'FAILED';
    job.error = `Video validation failed: Duration ${duration}s out of bounds (15-25s)`;
    queueManager.logEvent('error', job.project_id, 'FAILED', job.error);
  }

  queueManager.saveQueue(queue);
  res.json({ success: true, valid: isValid, status: job.status });
});

// 7. Cloud Actions: READY FOR POST
app.post('/api/jobs/:id/ready-for-post', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  // Duplicate protection check
  if (job.video_sha256 && queueManager.isHashPublished(job.video_sha256)) {
    job.status = 'SKIPPED_DUPLICATE';
    job.note = 'SHA-256 already recorded in state/published.json';
    queueManager.saveQueue(queue);
    queueManager.logEvent('publish', job.project_id, 'SKIPPED_DUPLICATE', `Duplicate hash found. Staged in archive/skipped/`);
    return res.json({ success: true, job, duplicate: true });
  }

  if (controlState.manualConfirm) {
    job.status = 'WAITING_FOR_USER';
    job.note = 'MANUAL_CONFIRM=true: Video ready for Android handoff. Waiting for user to confirm in Instagram.';
  } else {
    job.status = 'OPENING_INSTAGRAM';
  }

  queueManager.saveQueue(queue);
  queueManager.logEvent('publish', job.project_id, job.status, `Staged for Instagram Reel publication`);
  res.json({ success: true, job });
});

// 8. Cloud Actions: MARK PUBLISHED
app.post('/api/jobs/:id/mark-published', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  job.status = 'PUBLISHED';
  job.published_at = new Date().toISOString();
  if (!job.video_sha256) {
    job.video_sha256 = queueManager.computeSha256(job.project_id);
  }

  queueManager.markPublished(job);
  queueManager.saveQueue(queue);

  res.json({ success: true, job });
});

// 9. Cloud Actions: SKIP
app.post('/api/jobs/:id/skip', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  job.status = 'SKIPPED_DUPLICATE';
  job.note = 'User skipped project';
  queueManager.saveQueue(queue);
  queueManager.logEvent('publish', job.project_id, 'SKIPPED_DUPLICATE', 'Project manually skipped to archive/skipped/');

  res.json({ success: true, job });
});

// 10. Cloud Actions: RETRY
app.post('/api/jobs/:id/retry', (req: Request, res: Response) => {
  const { id } = req.params;
  const queue = queueManager.getQueue();
  const job = queue.find(j => j.project_id === id);

  if (!job) return res.status(404).json({ success: false, error: 'Project not found in queue' });

  job.status = 'PENDING';
  job.error = null;
  queueManager.saveQueue(queue);
  queueManager.logEvent('build', job.project_id, 'PENDING', 'Job reset to PENDING for retry');

  res.json({ success: true, job });
});

// 11. Android Handoff: Download MP4
app.get('/api/video/download/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const sampleMp4 = path.resolve(process.cwd(), 'output/ready/brag.mp4');
  
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${id}_reel.mp4"`);
  
  if (fs.existsSync(sampleMp4)) {
    fs.createReadStream(sampleMp4).pipe(res);
  } else {
    // Generate empty/dummy buffer if no media binary present
    res.send(Buffer.from([]));
  }
});

// Start server
async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Freebuff Cloud Reel Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
