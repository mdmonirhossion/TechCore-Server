import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger.js';

const router = express.Router();

// Raw OpenAPI JSON specification endpoint
router.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Swagger UI options for clean display
const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'TechCore API Documentation',
  customCss: '.swagger-ui .topbar { display: none } .swagger-ui .info { margin: 20px 0; }'
};

// Serve interactive Swagger UI documentation
router.use(
  '/docs',
  (req, res, next) => {
    // Ensure security headers do not block Swagger UI assets
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)
);

export default router;
