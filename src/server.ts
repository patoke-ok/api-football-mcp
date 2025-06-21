import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface ApiFootballResponse {
  get: string;
  parameters: any;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: any[];
}

class ApiFootballMCPServer {
  private server: Server;
  private apiKey: string;
  private baseUrl: string = 'https://v3.football.api-sports.io';

  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY || '';
    this.server = new Server(
      {
        name: 'api-football-betting',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private async makeApiRequest(endpoint: string, params: any = {}): Promise<ApiFootballResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'x-apisports-key': this.apiKey
        },
        params
      });
      return response.data;
    } catch (error) {
      throw new Error(`API request failed: ${error}`);
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_upcoming_fixtures',
            description: 'Get upcoming football fixtures for betting analysis',
            inputSchema: {
              type: 'object',
              properties: {
                league: {
                  type: 'string',
                  description: 'League ID or name (e.g., 39 for Premier League, 140 for La Liga)',
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format (optional, defaults to today)',
                },
                timezone: {
                  type: 'string',
                  description: 'Timezone (optional, defaults to UTC)',
                },
              },
            },
          },
          {
            name: 'get_team_form',
            description: 'Get recent form and performance of a team for betting insights',
            inputSchema: {
              type: 'object',
              properties: {
                team: {
                  type: 'string',
                  description: 'Team ID or name',
                },
                league: {
                  type: 'string',
                  description: 'League ID',
                },
                season: {
                  type: 'string',
                  description: 'Season year (optional, defaults to current season)',
                },
              },
              required: ['team', 'league'],
            },
          },
          {
            name: 'get_odds',
            description: 'Get betting odds for fixtures',
            inputSchema: {
              type: 'object',
              properties: {
                fixture: {
                  type: 'string',
                  description: 'Fixture ID (optional)',
                },
                league: {
                  type: 'string',
                  description: 'League ID (optional)',
                },
                bookmaker: {
                  type: 'string',
                  description: 'Bookmaker ID (optional, e.g., 8 for bet365)',
                },
              },
            },
          },
          {
            name: 'search_teams',
            description: 'Search for teams by name',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Team name to search for',
                },
              },
              required: ['name'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_upcoming_fixtures':
            return await this.getUpcomingFixtures(args);
          case 'get_team_form':
            return await this.getTeamForm(args);
          case 'get_odds':
            return await this.getOdds(args);
          case 'search_teams':
            return await this.searchTeams(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private async getUpcomingFixtures(args: any) {
    const params: any = {};
    
    if (args.league) params.league = args.league;
    if (args.date) params.date = args.date;
    if (args.timezone) params.timezone = args.timezone;

    const data = await this.makeApiRequest('/fixtures', params);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: `Found ${data.results} upcoming fixtures`,
            fixtures: data.response.slice(0, 10).map((fixture: any) => ({
              id: fixture.fixture.id,
              date: fixture.fixture.date,
              status: fixture.fixture.status.long,
              league: fixture.league.name,
              teams: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
              venue: fixture.fixture.venue?.name,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getTeamForm(args: any) {
    const params: any = {
      team: args.team,
      league: args.league,
    };
    
    if (args.season) params.season = args.season;

    const data = await this.makeApiRequest('/teams/statistics', params);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: `Team statistics for analysis`,
            statistics: data.response,
          }, null, 2),
        },
      ],
    };
  }

  private async getOdds(args: any) {
    const params: any = {};
    
    if (args.fixture) params.fixture = args.fixture;
    if (args.league) params.league = args.league;
    if (args.bookmaker) params.bookmaker = args.bookmaker;

    const data = await this.makeApiRequest('/odds', params);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: `Betting odds found`,
            odds: data.response.slice(0, 5).map((odd: any) => ({
              fixture: `${odd.fixture.teams.home.name} vs ${odd.fixture.teams.away.name}`,
              date: odd.fixture.date,
              bookmakers: odd.bookmakers?.slice(0, 3).map((bookmaker: any) => ({
                name: bookmaker.name,
                bets: bookmaker.bets?.slice(0, 3),
              })),
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async searchTeams(args: any) {
    const params: any = {
      search: args.name,
    };

    const data = await this.makeApiRequest('/teams', params);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: `Teams found matching "${args.name}"`,
            teams: data.response.slice(0, 10).map((item: any) => ({
              id: item.team.id,
              name: item.team.name,
              country: item.team.country,
              founded: item.team.founded,
            })),
          }, null, 2),
        },
      ],
    };
  }

  // Método para procesar requests HTTP
  async handleRequest(req: any, res: any) {
    try {
      if (req.method === 'POST' && req.path === '/mcp') {
        const { method, params } = req.body;
        
        let result;
        if (method === 'tools/list') {
          const listHandler = this.server.getRequestHandler(ListToolsRequestSchema);
          result = await listHandler({ method: 'tools/list', params: {} });
        } else if (method === 'tools/call') {
          const callHandler = this.server.getRequestHandler(CallToolRequestSchema);
          result = await callHandler({ method: 'tools/call', params });
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
        
        res.json(result);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const mcpServer = new ApiFootballMCPServer();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API-Football MCP Server is running',
    tools: [
      'get_upcoming_fixtures',
      'get_team_form', 
      'get_odds',
      'search_teams'
    ]
  });
});

// MCP endpoint
app.post('/mcp', async (req, res) => {
  await mcpServer.handleRequest(req, res);
});

// Tools list endpoint
app.get('/mcp', async (req, res) => {
  try {
    const listHandler = mcpServer['server'].getRequestHandler(ListToolsRequestSchema);
    const result = await listHandler({ method: 'tools/list', params: {} });
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.listen(port, () => {
  console.log(`API-Football MCP Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});