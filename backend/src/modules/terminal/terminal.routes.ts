import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth';

export const terminalRouter = Router();

// The actual terminal logic is handled in WebSocket
// This endpoint just provides info about terminal sessions
terminalRouter.get('/info', requireAdmin, (_req, res) => {
  res.json({ message: 'Terminal sessions handled via WebSocket /ws', powered_by: 'shadowblack' });
});
