const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY || '';
const BASE_URL = 'https://v3.football.api-sports.io';

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API-Football MCP Server is running',
    tools: ['get_upcoming_fixtures', 'search_teams']
  });
});

// MCP endpoint - Handle both GET and POST
app.all('/mcp', async (req, res) => {
  try {
    // Handle GET request (tools list)
    if (req.method === 'GET') {
      return res.json({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: 'get_upcoming_fixtures',
              description: 'Get upcoming football fixtures for betting analysis',
              inputSchema: {
                type: 'object',
                properties: {
                  league: { type: 'string', description: 'League ID (e.g., 39 for Premier League)' },
                  date: { type: 'string', description: 'Date in YYYY-MM-DD format' }
                }
              }
            },
            {
              name: 'search_teams',
              description: 'Search for teams by name',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Team name to search for' }
                },
                required: ['name']
              }
            }
          ]
        }
      });
    }

    // Handle POST request (tool execution)
    const { jsonrpc, method, params, id } = req.body;
    
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          tools: [
            {
              name: 'get_upcoming_fixtures',
              description: 'Get upcoming football fixtures for betting analysis',
              inputSchema: {
                type: 'object',
                properties: {
                  league: { type: 'string', description: 'League ID (e.g., 39 for Premier League)' },
                  date: { type: 'string', description: 'Date in YYYY-MM-DD format' }
                }
              }
            },
            {
              name: 'search_teams',
              description: 'Search for teams by name',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Team name to search for' }
                },
                required: ['name']
              }
            }
          ]
        }
      });
    }
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      if (name === 'search_teams') {
        const response = await axios.get(`${BASE_URL}/teams`, {
          headers: { 'x-apisports-key': API_KEY },
          params: { search: args.name }
        });
        
        return res.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                message: `Teams found matching "${args.name}"`,
                teams: response.data.response.slice(0, 5).map(item => ({
                  id: item.team.id,
                  name: item.team.name,
                  country: item.team.country
                }))
              }, null, 2)
            }]
          }
        });
      }
      
      if (name === 'get_upcoming_fixtures') {
        const response = await axios.get(`${BASE_URL}/fixtures`, {
          headers: { 'x-apisports-key': API_KEY },
          params: { 
            league: args.league || '39',
            next: '10'
          }
        });
        
        return res.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                message: `Found ${response.data.results} upcoming fixtures`,
                fixtures: response.data.response.slice(0, 5).map(fixture => ({
                  id: fixture.fixture.id,
                  date: fixture.fixture.date,
                  teams: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
                  league: fixture.league.name
                }))
              }, null, 2)
            }]
          }
        });
      }
    }
    
    res.status(400).json({ 
      jsonrpc: "2.0",
      id: id,
      error: { code: -32601, message: 'Method not found' }
    });
  } catch (error) {
    res.status(500).json({ 
      jsonrpc: "2.0",
      id: req.body?.id,
      error: { code: -32603, message: error.message }
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});