# Steam Review Analyser

A comprehensive application for scraping Steam game reviews and analyzing them using Large Language Models (LLMs). This tool enables developers and researchers to extract valuable insights from user reviews through automated sentiment analysis, topic modeling, and trend identification.

## Features

- **Steam API Integration**: Fetch reviews directly from Steam's API for any game
- **Multi-LLM Support**: Compatible with multiple LLM providers:
  - Ollama (local models)
  - OpenAI GPT models
  - Google Gemini
  - Anthropic Claude
- **Advanced Filtering**: Filter reviews by playtime, length, votes, early access status, and more
- **Real-time Analysis**: Live progress tracking with WebSocket integration
- **Modern UI**: React + TypeScript frontend with dark/light theme support
- **Data Export**: Export results in various formats (CSV, JSON)
- **Configurable**: Extensive configuration options via YAML

## Architecture

- **Backend**: Python-based API with FastAPI
- **Frontend**: React + TypeScript with Vite
- **UI Components**: shadcn/ui with Tailwind CSS
- **Data Processing**: Pandas for data manipulation
- **State Management**: React hooks with WebSocket real-time updates

## Installation

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r app/requirements.txt
```

4. Configure your settings in `config.yaml`

5. Set up environment variables (create `.env` file):
```bash
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
CLAUDE_API_KEY=your_claude_key
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Start the Backend

```bash
cd backend
python app/main.py
```

The backend API will be available at `http://localhost:8000`

### Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Configuration

Edit `backend/config.yaml` to customize:

- **LLM Providers**: Enable/disable different AI providers and models
- **Analysis Settings**: Number of reviews to analyze, retry policies, resume options
- **Fetching Options**: Reviews per app, language filters, date ranges
- **Filtering Criteria**: Review length, playtime requirements, voting thresholds
- **Output Paths**: Customize where files are saved

### Basic Workflow

1. **Configure**: Set up your LLM providers and analysis parameters in `config.yaml`
2. **Find Games**: Use the Finder page to search for Steam games and get their App IDs
3. **Set Parameters**: Configure review fetching and analysis settings
4. **Run Analysis**: Start the scraping and analysis process
5. **View Results**: Monitor progress in real-time and view results when complete

## API Endpoints

- `GET /health` - Health check
- `POST /analyze` - Start analysis process
- `GET /status` - Get current process status
- `GET /results/{app_id}` - Get analysis results
- `WS /ws` - WebSocket for real-time updates

## Output Files

The application generates three types of output:

- **Raw Reviews** (`output/raw/`): Original scraped review data
- **Analyzed Reviews** (`output/analysed/`): Reviews with LLM analysis results
- **Summary Reports** (`output/summary/`): Aggregated insights and topic analysis

## Development

### Project Structure

```
├── backend/
│   ├── app/
│   │   ├── core/           # Core business logic
│   │   ├── main.py         # FastAPI application
│   │   └── requirements.txt
│   └── config.yaml         # Configuration file
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Application pages
│   │   ├── api/           # API client
│   │   └── types/         # TypeScript definitions
│   └── package.json
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test` (frontend) and `pytest` (backend)
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions, issues, or feature requests, please open an issue on GitHub.

## Acknowledgments

- Steam Web API for review data
- shadcn/ui for beautiful UI components
- All the open-source LLM providers for making AI analysis accessible