import { Audit } from '../models/Audit.js';
import { normalizeAndValidateUrl } from '../services/fetcher.js';
import { runAuditPipeline, auditProgressEmitter } from '../services/auditEngine.js';
import { exportToJson, exportToCsv } from '../services/exportService.js';
import { generateExecutiveBrief, generateFindingFix } from '../services/geminiService.js';

/**
 * Start a new website audit
 */
export async function createAudit(req, res) {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Website URL is required' });
    }

    const normalizedUrl = normalizeAndValidateUrl(url);
    const domain = new URL(normalizedUrl).hostname;

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
 * Fetch a single audit report by ID
 */
export async function getAuditById(req, res) {
  try {
    const { id } = req.params;
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial state immediately
  try {
    const audit = await Audit.findById(id);
    if (!audit) {
      res.write(`data: ${JSON.stringify({ error: 'Audit not found' })}\n\n`);
      return res.end();
    }

    res.write(`data: ${JSON.stringify({
      auditId: audit._id,
      stage: audit.currentStage,
      percent: audit.progressPercent,
      status: audit.status,
      message: audit.errorMessage || `Current stage: ${audit.currentStage}`,
    })}\n\n`);

    if (audit.status === 'completed' || audit.status === 'failed') {
      return res.end();
    }
  } catch {
    return res.end();
  }

  // Listener for dynamic updates
  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.stage === 'completed' || data.stage === 'failed') {
      auditProgressEmitter.off(`progress:${id}`, listener);
      res.end();
    }
  };

  auditProgressEmitter.on(`progress:${id}`, listener);

  req.on('close', () => {
    auditProgressEmitter.off(`progress:${id}`, listener);
  });
}

/**
 * List historical audits with optional search filter
 */
export async function listAudits(req, res) {
  try {
    const { search, limit = 50 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { url: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { 'meta.pageTitle': { $regex: search, $options: 'i' } },
      ];
    }

    const audits = await Audit.find(query)
      .select('url domain status scores summary createdAt updatedAt meta.pageTitle meta.auditDurationMs currentStage progressPercent')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.json({ success: true, count: audits.length, audits });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Delete an audit record
 */
export async function deleteAudit(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Audit.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    return res.json({ success: true, message: 'Audit deleted successfully' });
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
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    const jsonString = exportToJson(audit);
    const filename = `sitesentry-${audit.domain}-${Date.now()}.json`;

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
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    const csvString = exportToCsv(audit);
    const filename = `sitesentry-${audit.domain}-${Date.now()}.csv`;

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
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    // Return cached if already generated to save free tier tokens
    if (audit.aiExecutiveBrief?.summary) {
      return res.json({ success: true, aiExecutiveBrief: audit.aiExecutiveBrief, cached: true });
    }

    const aiBrief = await generateExecutiveBrief(audit);
    audit.aiExecutiveBrief = aiBrief;
    await audit.save();

    return res.json({ success: true, aiExecutiveBrief: audit.aiExecutiveBrief, cached: false });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Generate & Cache Gemini AI Code Fix for a specific finding
 */
export async function generateFindingAiFixController(req, res) {
  try {
    const { id, findingId } = req.params;
    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    const finding = audit.findings.find(f => f.id === findingId);
    if (!finding) {
      return res.status(404).json({ success: false, error: 'Finding not found' });
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
    return res.status(500).json({ success: false, error: err.message });
  }
}
