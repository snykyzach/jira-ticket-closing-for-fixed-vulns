require('dotenv').config();
const axios = require('axios');

// Environment variables
const SNYK_API_TOKEN = process.env.SNYK_API_TOKEN;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const SNYK_ORG_ID = process.env.SNYK_ORG_ID;

// Axios headers for Snyk
const snykHeaders = {
  Authorization: `token ${SNYK_API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Axios headers for Jira
const jiraHeaders = {
  Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
  'Content-Type': 'application/json',
};

/**
 * Fetch resolved issues from Snyk.
 */
async function getResolvedIssues() {
  try {
    const response = await axios.get(
      `https://api.snyk.io/v1/org/${SNYK_ORG_ID}/issues`,
      {
        headers: snykHeaders,
        params: {
          state: 'fixed', // Only fetch resolved issues
          includeFixed: true,
        },
      }
    );
    return response.data.issues || [];
  } catch (error) {
    console.error('Error fetching resolved issues from Snyk:', error.message);
    return [];
  }
}

/**
 * Close a Jira ticket.
 * @param {string} issueKey - The Jira issue key (e.g., "PROJ-123").
 */
async function closeJiraTicket(issueKey) {
  try {
    // Get available transitions for the ticket
    const transitionResponse = await axios.get(
      `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
      { headers: jiraHeaders }
    );

    const transitions = transitionResponse.data.transitions;
    const doneTransition = transitions.find(
      (transition) => transition.name.toLowerCase() === 'done' || 
                      transition.name.toLowerCase() === 'resolved' || 
                      transition.name.toLowerCase() === 'close'
    );

    if (!doneTransition) {
      console.error(`No valid transition found for Jira ticket: ${issueKey}`);
      return;
    }

    // Perform the transition to close the ticket
    const transitionId = doneTransition.id;
    await axios.post(
      `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
      {
        transition: { id: transitionId },
      },
      { headers: jiraHeaders }
    );

    console.log(`Jira ticket ${issueKey} closed successfully.`);
  } catch (error) {
    console.error(`Failed to close Jira ticket ${issueKey}:`, error.message);
  }
}

/**
 * Sync resolved Snyk issues with Jira tickets.
 */
async function syncSnykWithJira() {
  try {
    const resolvedIssues = await getResolvedIssues();

    for (const issue of resolvedIssues) {
      const jiraTicketId = issue.jiraIssueKey; // Ensure the Snyk issue has a Jira ticket ID
      if (jiraTicketId) {
        console.log(`Closing Jira ticket ${jiraTicketId} for resolved Snyk issue ${issue.id}.`);
        await closeJiraTicket(jiraTicketId);
      } else {
        console.log(`Snyk issue ${issue.id} does not have a linked Jira ticket.`);
      }
    }
  } catch (error) {
    console.error('Error syncing Snyk issues with Jira:', error.message);
  }
}

// Run the sync process
syncSnykWithJira();