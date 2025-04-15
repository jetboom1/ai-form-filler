# AI Form Filler Browser Extension

An AI-powered browser extension that automatically fills out web forms based on your personal data. The extension uses RAG (Retrieval Augmented Generation) to find the most relevant information from your data and generate appropriate responses for form fields.

## Features

- Automatically detect forms on any webpage
- Fill forms with a single click
- Import your data from various formats (text, PDF, Word, Excel, etc.)
- Confidence scoring to prevent hallucination
- Data privacy through local processing
- Open-source and self-hostable

## Architecture

This project consists of three main components:

1. **Browser Extension**: The frontend that detects and fills forms
2. **Backend API**: Processes data and generates responses
3. **LLM Service**: Provides AI capabilities through Ollama

## Self-Hosting Guide

### System Requirements

- MacBook Pro 2023 (or any modern machine with 16GB+ RAM)
- Docker Desktop
- Chrome or Firefox browser

### Installation Steps

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/ai-form-filler.git
cd ai-form-filler
```

2. **Pull Ollama models**

Before starting the services, you'll need to download the language models:

```bash
docker run -it --rm -v ./ollama:/root/.ollama ollama/ollama pull gemma3
```

3. **Start the services**

```bash
docker-compose up -d
```

4. **Install the browser extension**

- **Chrome**:
  - Open `chrome://extensions/`
  - Enable Developer mode
  - Click "Load unpacked"
  - Select the `extension` folder

- **Firefox**:
  - Open `about:debugging#/runtime/this-firefox`
  - Click "Load Temporary Add-on"
  - Select any file in the `extension` folder

5. **Using the extension**

- Click the extension icon to open the popup
- Add your data using text input or file upload
- Navigate to a page with a form
- Click "Detect Form" to identify form fields
- Click "Fill Form" to automatically complete the form

### Project Structure

```
ai-form-filler/
├── backend/                # Backend API service
│   ├── app.py              # Flask application
│   ├── rag_pipeline.py     # LangChain RAG implementation
│   ├── Dockerfile          # Docker configuration
│   └── requirements.txt    # Python dependencies
├── extension/              # Browser extension
│   ├── manifest.json       # Extension manifest
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Popup logic
│   ├── content.js          # Content script for form interaction
│   └── background.js       # Background service worker
├── docker-compose.yml      # Docker Compose configuration
└── README.md               # This file
```

## Customization

### Changing the AI Model

This project uses Mistral 7B by default, but you can switch to other models by:

1. Edit the `.env` file or environment variables in docker-compose.yml:
   ```
   MODEL_NAME=phi3:mini  # Or any other Ollama model
   ```

2. Pull the new model:
   ```bash
   docker run -it --rm -v ./ollama:/root/.ollama ollama/ollama pull phi3:mini
   ```

3. Restart the services:
   ```bash
   docker-compose restart
   ```

### Changing Embedding Model

The default embedding model is `BAAI/bge-small-en-v1.5`, but you can change it:

1. Edit the environment variable in docker-compose.yml:
   ```
   EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
   ```

2. Restart the services:
   ```bash
   docker-compose restart
   ```

## Security Considerations

- All data is processed locally on your machine
- No data is sent to external services except between your browser and your local API
- User data is isolated by user ID
- Consider setting up proper authentication for production use

## Limitations

- The default models may not be perfect for all types of forms
- Performance depends on your machine's capabilities
- Some complex forms with JavaScript validation may not work perfectly

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
