# CLAUDE.md - AI Form Filler Project Guidelines

## Environment Setup & Commands
- **Install dependencies**: `pip install -r requirements.txt`
- **Run API server**: `python flask-api.py`
- **Run tests**: Not implemented yet
- **Code formatting**: Not specified, follow PEP 8 for Python

## Code Style Guidelines
- **Python**: Use type hints, follow PEP 8 standards
- **JavaScript**: Follow standard JS conventions, use camelCase
- **Error handling**: Use try/except blocks with specific exceptions
- **Imports**: Group in order: standard lib, third-party packages, local modules
- **Documentation**: Use docstrings for functions and classes (Google style)

## Project Architecture
- **Backend**: Flask API with LangChain RAG pipeline
- **Frontend**: Chrome extension with content/background scripts
- **Data processing**: Document loaders to vector store via ChromaDB

## Naming Conventions
- **Python**: snake_case for functions/variables, CamelCase for classes
- **JS**: camelCase for variables/functions
- **Constants**: UPPER_CASE

## Important Files
- `flask-api.py`: API server endpoints
- `langchain-rag-pipeline.py`: RAG implementation
- `extension/`: Browser extension components