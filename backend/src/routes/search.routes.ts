import { Router } from 'express';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { globalSearch } from '../services/search.service.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q as string) ?? '';
  const limit = parseInt(req.query.limit as string) || 10;
  const results = await globalSearch(currentUser(req), q, limit);
  res.json({ success: true, data: results });
}));