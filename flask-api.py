from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid
import tempfile
from werkzeug.utils import secure_filename
from rag_pipeline import FormFillerRAG

app = Flask(__name__)
CORS(app)  # Enable CORS for browser extension

# Initialize the RAG system
rag = FormFillerRAG()

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "ok"})

@app.route('/upload_text', methods=['POST'])
def upload_text():
    """
    Upload text data to the system
    
    Required JSON fields:
    - text: Text content to process
    - user_id: Unique identifier for the user
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        if 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
            
        if 'user_id' not in data:
            return jsonify({"error": "No user_id provided"}), 400
            
        # Process the text
        chunks = rag.process_text(data['text'], data['user_id'])
        
        return jsonify({
            "status": "success",
            "chunks_processed": chunks
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/upload_file', methods=['POST'])
def upload_file():
    """
    Upload a file to the system
    
    Required form fields:
    - file: File to process
    - user_id: Unique identifier for the user
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        if 'user_id' not in request.form:
            return jsonify({"error": "No user_id provided"}), 400
            
        file = request.files['file']
        user_id = request.form['user_id']
        
        if file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
            
        # Create a temporary file
        filename = secure_filename(file.filename)
        fd, temp_path = tempfile.mkstemp()
        
        try:
            # Save the file
            file.save(temp_path)
            
            # Process the file
            chunks = rag.process_document(temp_path, user_id)
            
            return jsonify({
                "status": "success",
                "chunks_processed": chunks
            })
            
        finally:
            os.close(fd)
            os.unlink(temp_path)  # Delete the temporary file
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/answer_question', methods=['POST'])
def answer_question():
    """
    Answer a form question
    
    Required JSON fields:
    - question: Form question to answer
    - user_id: Unique identifier for the user
    
    Optional JSON fields:
    - form_context: Additional context about the form
    - confidence_threshold: Minimum confidence score (default: 0.7)
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        if 'question' not in data:
            return jsonify({"error": "No question provided"}), 400
            
        if 'user_id' not in data:
            return jsonify({"error": "No user_id provided"}), 400
            
        # Get optional parameters
        form_context = data.get('form_context')
        confidence_threshold = float(data.get('confidence_threshold', 0.7))
        
        # Answer the question
        result = rag.answer_form_question(
            data['question'], 
            data['user_id'],
            form_context,
            confidence_threshold
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

@app.route('/clear_data', methods=['POST'])
def clear_data():
    """
    Clear all data for a user
    
    Required JSON fields:
    - user_id: Unique identifier for the user
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        if 'user_id' not in data:
            return jsonify({"error": "No user_id provided"}), 400
            
        # Clear the user data
        success = rag.clear_user_data(data['user_id'])
        
        if success:
            return jsonify({"status": "success"})
        else:
            return jsonify({"error": "Failed to clear user data"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
