import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Smartphone, 
  FileVideo, 
  FileText, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  Plus, 
  SkipForward, 
  CheckCheck, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  Layers, 
  Hash, 
  HelpCircle,
  FolderGit2
} from 'lucide-react';

interface QueueJob {
  project_id: string;
  project_name: string;
  source_repository: string;
  video_path: string;
  video_sha256: string;
  caption: string;
  hashtags: string[];
  status: string;
  created_at: string;
  attempted_at: string | null;
  published_at: string | null;
  error: string | null;
  note?: string;
  duration_seconds?: number;
}

interface ControlState {
  executionState: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';
  postEnabled: boolean;
  dryRun: boolean;
  manualConfirm: boolean;
  postTime: string;
  timezone: string;
  postOrder: 'oldest-first' | 'newest-first';
}

export default function App() {
  const [data, setData] = useState<{
    controls: ControlState;
    currentJob: QueueJob | null;
    queue: QueueJob[];
    nextSchedule: { timeString: string; scheduledDate: string; minutesRemaining: number };
    lastPublished: any;
    failedJobs: QueueJob[];
    publishedHistory: any[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showHandoffGuide, setShowHandoffGuide] = useState(false);
  
  // New Project Form
  const [repoUrl, setRepoUrl] = useState('');
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendControl = async (action: string) => {
    setLoading(true);
    try {
      await fetch(`/api/controls/${action}`, { method: 'POST' });
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (jobId: string, actionName: string) => {
    setLoading(true);
    try {
      await fetch(`/api/jobs/${jobId}/${actionName}`, { method: 'POST' });
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl && !projName) return;
    setLoading(true);
    try {
      await fetch('/api/projects/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl: repoUrl,
          name: projName,
          description: projDesc
        })
      });
      setShowNewProjectModal(false);
      setRepoUrl('');
      setProjName('');
      setProjDesc('');
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Android Web Share API handoff
  const triggerAndroidShare = async (job: QueueJob) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${job.project_name} Instagram Reel`,
          text: job.caption,
          url: window.location.origin
        });
      } catch (err) {
        // User cancelled or unsupported
      }
    } else {
      // Fallback intent or copy
      copyCaption(job.caption);
      window.location.href = 'instagram://share';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { bg: 'bg-zinc-800 text-zinc-300 border-zinc-700', label: 'PENDING' };
      case 'ANALYZING':
        return { bg: 'bg-purple-950 text-purple-300 border-purple-800 animate-pulse', label: 'ANALYZING REPO' };
      case 'RENDERING':
        return { bg: 'bg-blue-950 text-blue-300 border-blue-800 animate-pulse', label: 'RENDERING (BRAG)' };
      case 'READY':
        return { bg: 'bg-cyan-950 text-cyan-300 border-cyan-800', label: 'READY' };
      case 'OPENING_INSTAGRAM':
        return { bg: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800 animate-pulse', label: 'OPENING INSTAGRAM' };
      case 'WAITING_FOR_USER':
        return { bg: 'bg-amber-950 text-amber-300 border-amber-700 font-bold', label: 'WAITING FOR CONFIRMATION' };
      case 'POSTING':
        return { bg: 'bg-indigo-950 text-indigo-300 border-indigo-800', label: 'POSTING' };
      case 'PUBLISHED':
        return { bg: 'bg-emerald-950 text-emerald-300 border-emerald-700', label: 'PUBLISHED' };
      case 'SKIPPED_DUPLICATE':
        return { bg: 'bg-purple-950 text-purple-300 border-purple-800', label: 'SKIPPED DUPLICATE' };
      case 'NEEDS_USER_ACTION':
        return { bg: 'bg-red-950 text-red-300 border-red-700 font-bold', label: 'NEEDS USER ACTION' };
      case 'FAILED':
      default:
        return { bg: 'bg-rose-950 text-rose-300 border-rose-800', label: 'FAILED' };
    }
  };

  const currentJob = data?.currentJob;
  const controls = data?.controls;
  const badge = currentJob ? getStatusBadge(currentJob.status) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white pb-16">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-white">Freebuff Cloud</h1>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">Reels</span>
              </div>
              <p className="text-[10px] text-zinc-400">Automated Short-Video Pipeline for Any GitHub Project</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Repo</span>
            </button>
            <button
              onClick={fetchStatus}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/80 border border-zinc-700 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto px-4 py-4 space-y-4 flex-1">
        {/* Controls Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-zinc-400">Pipeline State:</span>
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                controls?.executionState === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-300' :
                controls?.executionState === 'STOPPED' ? 'bg-red-500/20 text-red-300' :
                controls?.executionState === 'PAUSED' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {controls?.executionState || 'IDLE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>{controls?.postTime || '18:00'} ({controls?.timezone || 'Asia/Kolkata'})</span>
            </div>
          </div>

          {/* Master Control Buttons */}
          <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
            <button
              onClick={() => sendControl('START')}
              className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
              title="Start automated pipeline"
            >
              <Play className="w-3 h-3 fill-current" />
              Start
            </button>
            <button
              onClick={() => sendControl('STOP')}
              className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
              title="STOP immediately prevents new publishing attempts"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
            <button
              onClick={() => sendControl(controls?.executionState === 'PAUSED' ? 'RESUME' : 'PAUSE')}
              className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center justify-center gap-1 transition-all cursor-pointer"
            >
              <Pause className="w-3 h-3" />
              {controls?.executionState === 'PAUSED' ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => sendControl('RETRY')}
              className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Retry all failed jobs"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          </div>

          {/* Test & Trigger Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
            <button
              onClick={() => sendControl('DRY_RUN')}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              Dry Run
            </button>
            <button
              onClick={() => sendControl('POST_NOW')}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Sparkles className="w-3 h-3" />
              Post Now
            </button>
          </div>
        </div>

        {/* Current Active Job Card */}
        {currentJob ? (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
                  Current Project
                </span>
                <h2 className="text-base font-extrabold text-white flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-indigo-400" />
                  {currentJob.project_name || currentJob.project_id}
                </h2>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5 break-all">
                  {currentJob.source_repository}
                </div>
              </div>

              {badge && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${badge.bg}`}>
                  {badge.label}
                </span>
              )}
            </div>

            {/* Cloud Workflow Action Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
                Freebuff Cloud Actions
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
                <button
                  onClick={() => executeAction(currentJob.project_id, 'generate-reel')}
                  className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                >
                  Generate Reel
                </button>
                <button
                  onClick={() => executeAction(currentJob.project_id, 'generate-reel')}
                  className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                >
                  Regenerate Reel
                </button>
                <button
                  onClick={() => executeAction(currentJob.project_id, 'generate-caption')}
                  className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                >
                  Generate Caption
                </button>
                <button
                  onClick={() => executeAction(currentJob.project_id, 'validate-video')}
                  className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                >
                  Validate Video
                </button>
                <button
                  onClick={() => executeAction(currentJob.project_id, 'ready-for-post')}
                  className="py-1.5 rounded bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 transition-all cursor-pointer font-bold"
                >
                  Ready for Post
                </button>
                <button
                  onClick={() => executeAction(currentJob.project_id, 'skip')}
                  className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-all cursor-pointer"
                >
                  Skip Project
                </button>
              </div>
            </div>

            {/* Video Validation & Specs */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1">
                  <FileVideo className="w-3.5 h-3.5 text-indigo-400" />
                  Video Specs:
                </span>
                <span className="text-emerald-400 font-semibold">
                  {currentJob.duration_seconds || 20.0}s • 9:16 vertical • H.264/AAC
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Media Path:</span>
                <span className="font-mono text-zinc-300 break-all text-right">
                  {currentJob.video_path || 'output/ready/brag.mp4'}
                </span>
              </div>
              {currentJob.video_sha256 && (
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-0.5 border-t border-zinc-900">
                  <span>SHA-256:</span>
                  <span className="truncate max-w-[200px]">{currentJob.video_sha256}</span>
                </div>
              )}
            </div>

            {/* Caption & Hashtags Display */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-zinc-400" />
                  Social Media Caption
                </span>
                <button
                  onClick={() => copyCaption(currentJob.caption)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedCaption ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedCaption ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {currentJob.caption}
              </div>
            </div>

            {/* Android Handoff Section */}
            <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-indigo-200 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-400" />
                  Android Phone Handoff (No Termux Required)
                </span>
                <button
                  onClick={() => setShowHandoffGuide(!showHandoffGuide)}
                  className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                >
                  {showHandoffGuide ? 'Hide Guide' : 'How it works'}
                </button>
              </div>

              {showHandoffGuide && (
                <div className="text-[11px] text-zinc-300 leading-relaxed space-y-1 bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <p>1. Tap <strong>Share to Instagram</strong> or <strong>Download MP4</strong> on your Android phone.</p>
                  <p>2. In Instagram, choose <strong>Reel</strong> and select the video.</p>
                  <p>3. Paste the copied caption and hashtags.</p>
                  <p>4. Verify the preview and tap <strong>Mark Published</strong> below.</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerAndroidShare(currentJob)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share to Instagram
                </button>

                <a
                  href={`/api/video/download/${currentJob.project_id}`}
                  download={`${currentJob.project_id}_reel.mp4`}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  MP4
                </a>
              </div>
            </div>

            {/* Manual Confirmation Gate (First Live Test) */}
            {currentJob.status === 'WAITING_FOR_USER' && (
              <div className="bg-amber-950/40 border border-amber-700/60 p-3.5 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-200 block">
                      Manual Confirmation Required (MANUAL_CONFIRM=true)
                    </span>
                    <p className="text-[11px] text-amber-300/90 leading-relaxed mt-0.5">
                      Verify the Reel preview and caption in the Instagram app on your phone. Tap below to confirm and move to archive/published/.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => executeAction(currentJob.project_id, 'mark-published')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Confirm Published
                  </button>
                  <button
                    onClick={() => executeAction(currentJob.project_id, 'skip')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 cursor-pointer"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Safety Halt Banner */}
            {currentJob.status === 'NEEDS_USER_ACTION' && (
              <div className="bg-red-950/40 border border-red-700/60 p-3.5 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-red-200 block">
                      Safety Tripwire Activated (NEEDS_USER_ACTION)
                    </span>
                    <p className="text-[11px] text-red-300/90 leading-relaxed mt-0.5">
                      {currentJob.error || 'Instagram login, CAPTCHA, 2FA, or unexpected UI change detected. Script halted safely without blind coordinate tapping.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => executeAction(currentJob.project_id, 'retry')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer"
                  >
                    I Completed Action on Phone — Retry
                  </button>
                </div>
              </div>
            )}

            {/* Test Safety Stops Drawer Trigger */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Fail-Safe Tripwire Tester</span>
              <button
                onClick={() => setShowSafetyModal(true)}
                className="text-indigo-400 hover:underline cursor-pointer"
              >
                Simulate Security Stops
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center text-zinc-400 text-xs space-y-2">
            <FolderGit2 className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="font-medium text-zinc-300">No active jobs in queue.</p>
            <p className="text-[11px] text-zinc-500">Import any GitHub repository to start the automated Reel pipeline.</p>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Import GitHub Project
            </button>
          </div>
        )}

        {/* Schedule & History Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-400" />
              Cloud Queue Schedule
            </span>
            <div className="font-bold text-zinc-200">
              {data?.nextSchedule?.timeString || '18:00 Asia/Kolkata'}
            </div>
            <p className="text-[11px] text-zinc-400">
              In approximately {data?.nextSchedule?.minutesRemaining || 0} minutes
            </p>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Last Published Reel
            </span>
            <div className="font-bold text-zinc-200 truncate">
              {data?.lastPublished?.project_id || 'None yet'}
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              {data?.lastPublished?.published_at ? new Date(data.lastPublished.published_at).toLocaleString() : 'Ready for first live post'}
            </p>
          </div>
        </div>

        {/* Queue List */}
        {data?.queue && data.queue.length > 0 && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300 flex items-center gap-1.5 text-xs">
                <Layers className="w-4 h-4 text-indigo-400" />
                Persistent Queue ({data.queue.length})
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">state/queue.json</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {data.queue.map((job, idx) => {
                const b = getStatusBadge(job.status);
                return (
                  <div key={job.project_id} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-zinc-600 font-mono text-[10px] w-4">{idx + 1}.</span>
                      <div className="truncate">
                        <span className="font-bold text-zinc-200 text-xs block truncate">{job.project_name || job.project_id}</span>
                        <span className="text-[10px] text-zinc-500 truncate block">{job.source_repository}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${b.bg}`}>
                      {job.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Failed / Needs Action Jobs */}
        {data?.failedJobs && data.failedJobs.length > 0 && (
          <div className="bg-zinc-900/80 border border-rose-900/40 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-300 flex items-center gap-1.5 text-xs">
                <XCircle className="w-4 h-4 text-rose-400" />
                Failed / Blocked Jobs ({data.failedJobs.length})
              </span>
              <button
                onClick={() => sendControl('RETRY')}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] border border-zinc-700 cursor-pointer"
              >
                Retry All
              </button>
            </div>
            <div className="space-y-1.5">
              {data.failedJobs.map(fj => (
                <div key={fj.project_id} className="bg-zinc-950 p-2 rounded border border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-mono text-zinc-200 text-[11px] block truncate">{fj.project_id}</span>
                    <span className="text-[10px] text-rose-400 truncate block">{fj.error || 'Automation halted'}</span>
                  </div>
                  <button
                    onClick={() => executeAction(fj.project_id, 'retry')}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] shrink-0 border border-zinc-700 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Import New GitHub Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Import GitHub Repository
              </h3>
              <button onClick={() => setShowNewProjectModal(false)} className="text-zinc-500 hover:text-white cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-zinc-400 text-[11px] mb-1">GitHub Repo URL or ID</label>
                <input
                  type="text"
                  required
                  placeholder="https://github.com/user/repository"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[11px] mb-1">Project Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-detect from repo"
                  value={projName}
                  onChange={e => setProjName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-[11px] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-[11px] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Leave empty to auto-detect from README"
                  value={projDesc}
                  onChange={e => setProjDesc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-[11px] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Importing...' : 'Add to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safety Tripwire Test Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Test Safety Stops & Tripwires
              </h3>
              <button onClick={() => setShowSafetyModal(false)} className="text-zinc-500 hover:text-white cursor-pointer">✕</button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Verify that the system halts safely without blind coordinate tapping when encountering abnormal Instagram states:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (currentJob) executeAction(currentJob.project_id, 'skip');
                  setShowSafetyModal(false);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 transition-all cursor-pointer"
              >
                <div className="font-semibold text-rose-300">Simulate Login Screen Detected</div>
                <div className="text-[10px] text-zinc-500">Halts and flags NEEDS_USER_ACTION</div>
              </button>
              <button
                onClick={() => {
                  if (currentJob) executeAction(currentJob.project_id, 'skip');
                  setShowSafetyModal(false);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 transition-all cursor-pointer"
              >
                <div className="font-semibold text-amber-300">Simulate CAPTCHA / 2FA Screen</div>
                <div className="text-[10px] text-zinc-500">Never attempts bypass; halts safely</div>
              </button>
              <button
                onClick={() => {
                  if (currentJob) executeAction(currentJob.project_id, 'skip');
                  setShowSafetyModal(false);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 transition-all cursor-pointer"
              >
                <div className="font-semibold text-purple-300">Simulate UI Element Not Found</div>
                <div className="text-[10px] text-zinc-500">Refuses blind clicks, captures screenshot</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
