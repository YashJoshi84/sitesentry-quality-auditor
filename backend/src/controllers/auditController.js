import mongoose from 'mongoose';
import { Audit } from '../models/Audit.js';
import { normalizeAndValidateUrl } from '../services/fetcher.js';
import { runAuditPipeline, auditProgressEmitter, cancelActiveAudit } from '../services/auditEngine.js';
import { exportToJson, exportToCsv } from '../services/exportService.js';
import { generateExecutiveBrief, generateFindingFix } from '../services/geminiService.js';

/**
 * Start a new website audit
 */
export async function createAudit(req, res) {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Website URL is required and must be a string.' });
    }

    if (url.trim().length > 2048) {
      return res.status(400).json({ success: false, error: 'URL exceeds maximum length of 2048 characters.' });
    }

    const normalizedUrl = await normalizeAndValidateUrl(url);
    const domain = new URL(normalizedUrl).hostname;

    // Check for existing active audit on the same URL started within the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const existingActive = await Audit.findOne({
      url: normalizedUrl,
      status: { $in: ['pending', 'in_progress', 'running'] },
      createdAt: { $gte: thirtySecondsAgo },
    });

    if (existingActive) {
      return res.status(200).json({
        success: true,
        auditId: existingActive._id,
        url: existingActive.url,
        domain: existingActive.domain,
        status: existingActive.status,
        message: 'Active audit already in progress for this URL',
        isExisting: true,
      });
    }

    const audit = new Audit({
      url: normalizedUrl,
      domain,
      status: 'pending',
      currentStage: 'queued',
      progressPercent: 5,
    });

    await audit.save();

    // Trigger pipeline asynchronously so response returns instantly
    runAuditPipeline(audit._id).catch((err) => {
      console.error(`[Background Audit Error] ${audit._id}:`, err.message);
    });

    return res.status(201).json({
      success: true,
      auditId: audit._id,
      url: audit.url,
      domain: audit.domain,
      status: audit.status,
      message: 'Audit started successfully',
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * Cancel an ongoing audit
 */
export async function cancelAudit(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const audit = await Audit.findById(id);
    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found.' });
    }

    if (['completed', 'partially_completed', 'failed', 'cancelled'].includes(audit.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel audit that is already in terminal state "${audit.status}".`,
      });
    }

    cancelActiveAudit(id);
    audit.status = 'cancelled';
    audit.currentStage = 'cancelled';
    audit.errorMessage = 'Audit was cancelled by user request.';
    await audit.save();

    auditProgressEmitter.emit(`progress:${id}`, {
      auditId: id,
      stage: 'cancelled',
      percent: 100,
      message: 'Audit execution cancelled by user request.',
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Audit cancellation requested.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Fetch a single audit report by ID
 */
export async function getAuditById(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found.' });
    }

    return res.json({ success: true, audit });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Server-Sent Events (SSE) stream for live progress updates
 */
export async function streamAuditProgress(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeSSE = (data, event = null) => {
    if (event) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Heartbeat interval (every 15s) to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Send initial state immediately
  try {
    const audit = await Audit.findById(id);
    if (!audit) {
      writeSSE({ error: 'Audit not found' }, 'failed');
      clearInterval(heartbeat);
      return res.end();
    }

    const isTerminal = ['completed', 'partially_completed', 'failed', 'cancelled'].includes(audit.status);

    const initialState = {
      auditId: audit._id,
      stage: audit.currentStage,
      percent: audit.progressPercent,
      status: audit.status,
      message: audit.errorMessage || `Current stage: ${audit.currentStage}`,
    };

    const eventName = isTerminal ? (audit.status === 'failed' ? 'failed' : 'completed') : 'progress';
    writeSSE(initialState, eventName);

    if (isTerminal) {
      clearInterval(heartbeat);
      return res.end();
    }
  } catch {
    clearInterval(heartbeat);
    return res.end();
  }

  // Listener for dynamic updates
  const listener = (data) => {
    const isTerminal = ['completed', 'partially_completed', 'failed', 'cancelled'].includes(data.stage);
    const eventName = isTerminal ? (data.stage === 'failed' ? 'failed' : 'completed') : 'progress';
    writeSSE(data, eventName);
    if (isTerminal) {
      clearInterval(heartbeat);
      auditProgressEmitter.off(`progress:${id}`, listener);
      res.end();
    }
  };

  auditProgressEmitter.on(`progress:${id}`, listener);

  req.on('close', () => {
    clearInterval(heartbeat);
    auditProgressEmitter.off(`progress:${id}`, listener);
  });
}

/**
 * List historical audits with optional search filter
 */
export async function listAudits(req, res) {
  try {
    const { search, limit = 50 } = req.query;
    const sanitizedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const query = {};

    if (search && typeof search === 'string') {
      const sanitizedSearch = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (sanitizedSearch) {
        query.$or = [
          { url: { $regex: sanitizedSearch, $options: 'i' } },
          { domain: { $regex: sanitizedSearch, $options: 'i' } },
          { 'meta.pageTitle': { $regex: sanitizedSearch, $options: 'i' } },
        ];
      }
    }

    const audits = await Audit.find(query)
      .select('url domain status currentStage progressPercent scores summary meta createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(sanitizedLimit)
      .lean();

    return res.json({ success: true, count: audits.length, audits });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Delete a specific audit report
 */
export async function deleteAudit(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const deleted = await Audit.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Audit not found or already deleted.' });
    }

    return res.json({ success: true, message: 'Audit deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Export audit as JSON file
 */
export async function exportAuditJson(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found.' });
    }

    const jsonString = exportToJson(audit);
    const sanitizedDomain = audit.domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `sitesentry-${sanitizedDomain}-${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(jsonString);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Export audit as CSV file
 */
export async function exportAuditCsv(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found.' });
    }

    const csvString = exportToCsv(audit);
    const sanitizedDomain = audit.domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `sitesentry-${sanitizedDomain}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvString);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Generate & Cache Gemini AI Executive Brief
 */
export async function generateAuditAiBrief(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found.' });
    }

    // Return cached if already generated to save tokens
    if (audit.aiExecutiveBrief?.summary) {
      return res.json({ success: true, aiExecutiveBrief: audit.aiExecutiveBrief, cached: true });
    }

    const aiBrief = await generateExecutiveBrief(audit);
    audit.aiExecutiveBrief = aiBrief;
    await audit.save();

    return res.json({ success: true, aiExecutiveBrief: audit.aiExecutiveBrief, cached: false });
  } catch (err) {
    return res.status(502).json({ success: false, error: `AI recommendation unavailable: ${err.message}` });
  }
}

/**
 * Generate & Cache Gemini AI Code Fix for a specific finding
 */
export async function generateFindingAiFixController(req, res) {
  try {
    const { id, findingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid audit identifier format.' });
    }

    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found.' });
    }

    const finding = audit.findings.find(f => f.id === findingId);
    if (!finding) {
      return res.status(404).json({ success: false, error: 'Finding not found.' });
    }

    // Return cached if already generated to save tokens
    if (finding.aiFix?.code) {
      return res.json({ success: true, aiFix: finding.aiFix, cached: true });
    }

    const fixResult = await generateFindingFix(audit, finding);
    finding.aiFix = fixResult;
    await audit.save();

    return res.json({ success: true, aiFix: finding.aiFix, cached: false });
  } catch (err) {
    return res.status(502).json({ success: false, error: `AI code fix unavailable: ${err.message}` });
  }
}
