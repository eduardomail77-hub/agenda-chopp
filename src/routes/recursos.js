import express from 'express';
import {
  getChopeiras,
  getChopeirasDisponiveisPorData,
  getCervejas,
} from '../controllers/chopeirasController.js';

const router = express.Router();

// GET /api/recursos/chopeiras - Listar todas as chopeiras
router.get('/chopeiras', getChopeiras);

// GET /api/recursos/chopeiras/disponibles - Chopeiras disponíveis por data
router.get('/chopeiras/disponibles', getChopeirasDisponiveisPorData);

// GET /api/recursos/cervejas - Listar todas as cervejas
router.get('/cervejas', getCervejas);

export default router;
