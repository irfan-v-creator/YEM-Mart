import app, { app as expressApp } from '../server.js';

// Standard Vercel serverless export handler wrapping Express app
export { expressApp as app };
export default app;

