import express from 'express';
import {
  createAudit,
  getAuditById,
  streamAuditProgress,
  listAudits,
  deleteAudit,
  exportAuditJson,
  exportAuditCsv,
  generateAuditAiBrief,
  generateFindingAiFixController,
} from '../controllers/auditController.js';

const router = express.Router();

router.post('/', createAudit);
router.get('/', listAudits);
router.get('/:id', getAuditById);
router.get('/:id/progress', streamAuditProgress);
router.delete('/:id', deleteAudit);
router.get('/:id/export/json', exportAuditJson);
router.get('/:id/export/csv', exportAuditCsv);

// Gemini AI Routes
router.post('/:id/ai-brief', generateAuditAiBrief);
router.post('/:id/findings/:findingId/ai-fix', generateFindingAiFixController);

export default router;
