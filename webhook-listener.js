require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON payloads
app.use(bodyParser.json());

// Helper function to verify the webhook signature
// This is key to verify the webhook payload is authentic and has integrity.
function verifySignature(req, res, next) {
  const signature = req.headers['x-hub-signature'];
  if (!signature) {
    console.error('No signature provided');
    return res.status(403).send('Forbidden');
  }

  // Recreate the signature using the payload and secret
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', process.env.SNYK_WEBHOOK_SECRET);
  hmac.update(payload);
  const calculatedSignature = `sha256=${hmac.digest('hex')}`;

  if (calculatedSignature !== signature) {
    console.error('Invalid signature');
    return res.status(403).send('Invalid signature');
  }

  // If the signature is valid, move to the next middleware/handler
  next();
}

// Webhook endpoint with signature verification
app.post('/webhook', verifySignature, (req, res) => {
  console.log('Webhook received:', req.body);

  const { event, data } = req.body;

  // Process only "issue.fixed" events
  if (event === 'issue.fixed') {
    console.log(`Resolved issue detected: ${data.issueId}`);

    // Trigger the Jira sync script
    exec('node sync-snyk-jira.js', (err, stdout, stderr) => {
      if (err) {
        console.error(`Error executing script: ${err.message}`);
        return;
      }
      console.log(`Script output:\n${stdout}`);
      if (stderr) console.error(`Script errors:\n${stderr}`);
    });
  }

  res.status(200).send('Webhook processed');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
