const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API-Football MCP Server for OpenAI Deep Research'
  });
});

// Simple MCP endpoint for OpenAI
app.get('/mcp', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send tools data
  const response = {
    tools: [
      {
        name: "search",
        description: "Search for football teams and matches for betting analysis",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" }
          },
          required: ["query"]
        }
      }
    ]
  };

  res.write(`data: ${JSON.stringify(response)}\n\n`);
  
  // Keep connection alive
  const interval = setInterval(() => {
    res.write(`data: {"ping": true}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Handle POST requests
app.post('/mcp', (req, res) => {
  res.json({
    jsonrpc: "2.0",
    id: req.body?.id || 1,
    result: {
      results: [
        {
          id: "test-1",
          title: "Football Data Available",
          text: "This is a test response for football betting analysis",
          url: null
        }
      ]
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});