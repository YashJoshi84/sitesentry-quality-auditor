import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema({
  id: { type: String, required: true },
  category: {
    type: String,
    enum: ['seo', 'accessibility', 'broken_links', 'mobile'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['critical', 'warning', 'info', 'passed'],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  evidence: { type: String, default: '' },
  selector: { type: String, default: '' },
  recommendation: { type: String, required: true },
  aiFix: {
    code: { type: String, default: null },
    explanation: { type: String, default: null },
    language: { type: String, default: 'html' },
    generatedAt: { type: Date, default: null },
  },
}, { _id: false });

const checkedLinkSchema = new mongoose.Schema({
  url: { type: String, required: true },
  status: { type: Number, default: null },
  ok: { type: Boolean, default: false },
  statusText: { type: String, default: '' },
  durationMs: { type: Number, default: 0 },
  error: { type: String, default: null },
  sourceSnippet: { type: String, default: '' }
}, { _id: false });

const auditSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, index: true },
    domain: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    currentStage: {
      type: String,
      default: 'queued',
    },
    progressPercent: {
      type: Number,
      default: 0,
    },
    scores: {
      overall: { type: Number, default: 0 },
      seo: { type: Number, default: 0 },
      a11y: { type: Number, default: 0 },
      brokenLinks: { type: Number, default: 0 },
      mobileReadiness: { type: Number, default: 0 },
    },
    summary: {
      passedCount: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 },
    },
    findings: [findingSchema],
    checkedLinks: [checkedLinkSchema],
    aiExecutiveBrief: {
      summary: { type: String, default: null },
      topRecommendations: [{ type: String }],
      estimatedFixTime: { type: String, default: null },
      generatedAt: { type: Date, default: null },
    },
    meta: {
      pageTitle: { type: String, default: '' },
      canonical: { type: String, default: '' },
      httpStatus: { type: Number, default: 200 },
      contentType: { type: String, default: 'text/html' },
      loadTimeMs: { type: Number, default: 0 },
      htmlSizeBytes: { type: Number, default: 0 },
      headingsCount: {
        h1: { type: Number, default: 0 },
        h2: { type: Number, default: 0 },
        h3: { type: Number, default: 0 },
      },
      imagesCount: {
        total: { type: Number, default: 0 },
        missingAlt: { type: Number, default: 0 },
      },
      linksCount: {
        totalFound: { type: Number, default: 0 },
        checked: { type: Number, default: 0 },
        broken: { type: Number, default: 0 },
      },
      auditDurationMs: { type: Number, default: 0 },
    },
    errorMessage: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

auditSchema.index({ createdAt: -1 });

export const Audit = mongoose.model('Audit', auditSchema);
