const express = require('express');
const { randomUUID } = require('crypto');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY || '';
const BASE_URL = 'https://v3.football.api-sports.io';

// Store sessions
const sessions = new Map();

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MCP Server for Football Betting Analysis',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp (POST for JSON-RPC, GET for SSE)',
      sse: '/sse (SSE only)',
      health: '/'
    }
  });
});

// MCP Streamable HTTP endpoint (POST)
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request" },
        id: id
      });
    }

    // Handle initialization
    if (method === "initialize") {
      const sessionId = req.headers['mcp-session-id'] || randomUUID();
      
      sessions.set(sessionId, {
        id: sessionId,
        capabilities: params?.capabilities || {}
      });

      res.setHeader('mcp-session-id', sessionId);
      return res.json({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: "football-betting-mcp",
            version: "1.0.0"
          }
        },
        id: id
      });
    }

    // Handle tools/list
    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "search_teams",
              description: "Search for football teams for betting analysis. Use team names like 'Manchester', 'Barcelona', etc.",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Team name to search for"
                  }
                },
                required: ["query"]
              }
            },
            {
              name: "get_fixtures",
              description: "Get upcoming football fixtures for betting analysis. Specify league ID: 39=Premier League, 140=La Liga, 135=Serie A, 78=Bundesliga",
              inputSchema: {
                type: "object",
                properties: {
                  league: {
                    type: "string",
                    description: "League ID (39=Premier League, 140=La Liga, 135=Serie A, 78=Bundesliga)",
                    default: "39"
                  }
                },
                required: []
              }
            }
          ]
        },
        id: id
      });
    }

    // Handle tools/call
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      if (name === "search_teams") {
        const result = await searchTeams(args.query);
        return res.json({
          jsonrpc: "2.0",
          result: {
            content: [{
              type: "text",
              text: result
            }]
          },
          id: id
        });
      }
      
      if (name === "get_fixtures") {
        const result = await getFixtures(args.league || "39");
        return res.json({
          jsonrpc: "2.0",
          result: {
            content: [{
              type: "text",
              text: result
            }]
          },
          id: id
        });
      }
      
      return res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32601, message: "Method not found" },
        id: id
      });
    }

    // Handle resources/list
    if (method === "resources/list") {
      return res.json({
        jsonrpc: "2.0",
        result: {
          resources: []
        },
        id: id
      });
    }

    // Handle other methods
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Method not found" },
      id: id
    });

  } catch (error) {
    console.error('MCP Error:', error);
    return res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal error" },
      id: req.body?.id || null
    });
  }
});

// SSE endpoint para compatibilidad con clientes que esperan SSE (GET /mcp)
app.get('/mcp', (req, res) => {
  // Headers SSE requeridos
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  // Enviar información inicial del servidor
  const serverInfo = {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      resources: {}
    },
    serverInfo: {
      name: "football-betting-mcp",
      version: "1.0.0"
    },
    tools: [
      {
        name: "search_teams",
        description: "Search for football teams for betting analysis",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Team name to search" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_fixtures", 
        description: "Get upcoming football fixtures for betting analysis",
        inputSchema: {
          type: "object",
          properties: {
            league: { type: "string", description: "League ID", default: "39" }
          }
        }
      }
    ]
  };

  // Enviar como evento SSE
  res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);

  // Mantener conexión viva
  const keepAlive = setInterval(() => {
    res.write(`data: {"ping": ${Date.now()}}\n\n`);
  }, 30000);

  // Limpiar al cerrar
  req.on('close', () => {
    clearInterval(keepAlive);
  });

  req.on('error', () => {
    clearInterval(keepAlive);
  });
});

// Endpoint alternativo para SSE
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const tools = [
    {
      name: "search_teams",
      description: "Search for football teams for betting analysis",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Team name to search" }
        },
        required: ["query"]
      }
    },
    {
      name: "get_fixtures", 
      description: "Get upcoming football fixtures for betting analysis",
      inputSchema: {
        type: "object",
        properties: {
          league: { type: "string", description: "League ID", default: "39" }
        }
      }
    }
  ];

  res.write(`data: ${JSON.stringify({ tools })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(`data: {"heartbeat": ${Date.now()}}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Search teams function
async function searchTeams(query) {
  try {
    const axios = require('axios');
    const response = await axios.get(`${BASE_URL}/teams`, {
      headers: { 'x-apisports-key': API_KEY },
      params: { search: query }
    });
    
    const teams = response.data.response.slice(0, 5).map(item => ({
      id: item.team.id,
      name: item.team.name,
      country: item.team.country,
      founded: item.team.founded
    }));
    
    return `Football teams matching "${query}":\n\n` + 
           teams.map(team => `• ${team.name} (${team.country}) - Founded: ${team.founded || 'N/A'} - ID: ${team.id}`).join('\n') +
           '\n\nThese teams can be used for betting analysis and statistics lookup.';
  } catch (error) {
    return `Error searching teams: ${error.message}`;
  }
}

// Get fixtures function
async function getFixtures(leagueId) {
  try {
    const axios = require('axios');
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: { 'x-apisports-key': API_KEY },
      params: { 
        league: leagueId,
        next: '10'
      }
    });
    
    const fixtures = response.data.response.slice(0, 5).map(fixture => ({
      id: fixture.fixture.id,
      date: new Date(fixture.fixture.date).toLocaleDateString(),
      time: new Date(fixture.fixture.date).toLocaleTimeString(),
      home: fixture.teams.home.name,
      away: fixture.teams.away.name,
      league: fixture.league.name,
      status: fixture.fixture.status.long
    }));
    
    const leagueNames = {
      '39': 'Premier League',
      '140': 'La Liga',
      '135': 'Serie A',
      '78': 'Bundesliga'
    };
    
    return `Upcoming fixtures for ${leagueNames[leagueId] || 'League'}:\n\n` +
           fixtures.map(f => `• ${f.home} vs ${f.away}\n  Date: ${f.date} ${f.time}\n  League: ${f.league}\n  Status: ${f.status}\n  Fixture ID: ${f.id}`).join('\n\n') +
           '\n\nUse these fixtures for betting analysis and odds comparison.';
  } catch (error) {
    return `Error getting fixtures: ${error.message}`;
  }
}

app.listen(port, () => {
  console.log(`MCP Server running on port ${port}`);
  console.log('Protocol: JSON-RPC 2.0 over Streamable HTTP + SSE compatibility');
  console.log('Endpoints:');
  console.log('  POST /mcp - JSON-RPC 2.0');
  console.log('  GET /mcp - SSE stream');
  console.log('  GET /sse - SSE stream (alternative)');
  console.log('  GET / - Health check');
});