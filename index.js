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
    message: 'API-Football MCP Server for OpenAI Deep Research'
  });
});

// SSE endpoint para OpenAI MCP
app.get('/mcp', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  // Enviar herramientas disponibles
  const tools = {
    tools: [
      {
        name: "search",
        description: "Search for football data for betting analysis. Use queries like 'Premier League fixtures', 'Manchester teams', 'La Liga upcoming matches', etc.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string", 
              description: "Search query for football data (teams, leagues, fixtures)"
            }
          },
          required: ["query"]
        },
        output_schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "ID of the resource" },
                  title: { type: "string", description: "Title of the resource" },
                  text: { type: "string", description: "Text content" },
                  url: { type: ["string", "null"], description: "URL of the resource" }
                },
                required: ["id", "title", "text"]
              }
            }
          },
          required: ["results"]
        }
      },
      {
        name: "fetch",
        description: "Retrieve detailed content for a specific football resource",
        input_schema: {
          type: "object",
          properties: {
            id: { type: "string", description: "ID of the resource to fetch" }
          },
          required: ["id"]
        },
        output_schema: {
          type: "object",
          properties: {
            id: { type: "string", description: "ID of the resource" },
            title: { type: "string", description: "Title of the resource" },
            text: { type: "string", description: "Complete content" },
            url: { type: ["string", "null"], description: "URL of the resource" }
          },
          required: ["id", "title", "text"]
        }
      }
    ]
  };

  res.write(`data: ${JSON.stringify(tools)}\n\n`);
  
  // Mantener conexión abierta
  const keepAlive = setInterval(() => {
    res.write(`data: {"ping": true}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Endpoint POST para ejecutar herramientas
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      if (name === 'search') {
        const searchResults = await searchFootballData(args.query);
        return res.json({
          jsonrpc: "2.0",
          id: id,
          result: { results: searchResults }
        });
      }
      
      if (name === 'fetch') {
        const fetchResult = await fetchFootballData(args.id);
        return res.json({
          jsonrpc: "2.0",
          id: id,
          result: fetchResult
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

// Función para buscar datos de fútbol
async function searchFootballData(query) {
  try {
    let results = [];
    
    // Si busca equipos
    if (query.toLowerCase().includes('team') || query.toLowerCase().includes('manchester') || query.toLowerCase().includes('barcelona')) {
      const response = await axios.get(`${BASE_URL}/teams`, {
        headers: { 'x-apisports-key': API_KEY },
        params: { search: query.split(' ')[0] }
      });
      
      results = response.data.response.slice(0, 5).map(item => ({
        id: `team-${item.team.id}`,
        title: `${item.team.name} (${item.team.country})`,
        text: `Football team: ${item.team.name}, Country: ${item.team.country}, Founded: ${item.team.founded || 'N/A'}`,
        url: null
      }));
    }
    
    // Si busca fixtures/partidos
    else if (query.toLowerCase().includes('fixture') || query.toLowerCase().includes('match') || query.toLowerCase().includes('upcoming')) {
      let leagueId = '39'; // Premier League por defecto
      if (query.toLowerCase().includes('la liga')) leagueId = '140';
      if (query.toLowerCase().includes('serie a')) leagueId = '135';
      if (query.toLowerCase().includes('bundesliga')) leagueId = '78';
      
      const response = await axios.get(`${BASE_URL}/fixtures`, {
        headers: { 'x-apisports-key': API_KEY },
        params: { league: leagueId, next: '10' }
      });
      
      results = response.data.response.slice(0, 5).map(fixture => ({
        id: `fixture-${fixture.fixture.id}`,
        title: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
        text: `Match: ${fixture.teams.home.name} vs ${fixture.teams.away.name}, League: ${fixture.league.name}, Date: ${fixture.fixture.date}, Status: ${fixture.fixture.status.long}`,
        url: null
      }));
    }
    
    // Búsqueda general
    else {
      results = [
        {
          id: 'general-1',
          title: 'Football Data Search',
          text: `Search results for "${query}". Try searching for specific teams like "Manchester" or "Barcelona", or upcoming fixtures like "Premier League fixtures".`,
          url: null
        }
      ];
    }
    
    return results;
  } catch (error) {
    return [{
      id: 'error-1',
      title: 'Search Error',
      text: `Error searching for "${query}": ${error.message}`,
      url: null
    }];
  }
}

// Función para obtener datos específicos
async function fetchFootballData(id) {
  try {
    const [type, resourceId] = id.split('-');
    
    if (type === 'team') {
      const response = await axios.get(`${BASE_URL}/teams/statistics`, {
        headers: { 'x-apisports-key': API_KEY },
        params: { team: resourceId, league: '39', season: '2024' }
      });
      
      const stats = response.data.response;
      return {
        id: id,
        title: `${stats.team?.name || 'Team'} Statistics`,
        text: `Detailed statistics: Games played: ${stats.fixtures?.played?.total || 'N/A'}, Wins: ${stats.fixtures?.wins?.total || 'N/A'}, Losses: ${stats.fixtures?.loses?.total || 'N/A'}, Goals for: ${stats.goals?.for?.total || 'N/A'}, Goals against: ${stats.goals?.against?.total || 'N/A'}`,
        url: null
      };
    }
    
    if (type === 'fixture') {
      const response = await axios.get(`${BASE_URL}/fixtures`, {
        headers: { 'x-apisports-key': API_KEY },
        params: { id: resourceId }
      });
      
      const fixture = response.data.response[0];
      return {
        id: id,
        title: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
        text: `Match details: ${fixture.teams.home.name} vs ${fixture.teams.away.name}, League: ${fixture.league.name}, Date: ${fixture.fixture.date}, Venue: ${fixture.fixture.venue?.name || 'TBD'}, Status: ${fixture.fixture.status.long}`,
        url: null
      };
    }
    
    return {
      id: id,
      title: 'Resource Not Found',
      text: `Could not fetch details for resource ${id}`,
      url: null
    };
  } catch (error) {
    return {
      id: id,
      title: 'Fetch Error',
      text: `Error fetching resource ${id}: ${error.message}`,
      url: null
    };
  }
}

app.listen(port, () => {
  console.log(`API-Football MCP Server running on port ${port}`);
  console.log('Compatible with OpenAI Deep Research');
});