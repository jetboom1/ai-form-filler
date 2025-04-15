

from langchain_community.document_loaders import CSVLoader

from langchain_community.document_loaders import PyPDFLoader

from langchain_community.document_loaders import TextLoader

from langchain_community.document_loaders import UnstructuredExcelLoader

from langchain_community.document_loaders import UnstructuredPowerPointLoader

from langchain_community.document_loaders import UnstructuredWordDocumentLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
import os
from typing import Dict, List, Optional, Any

class FormFillerRAG:
    """RAG-based system for intelligently filling out forms based on user-provided data."""

    def __init__(self, 
                 model_name: str = "gemma3", 
                 embedding_model: str = "BAAI/bge-small-en-v1.5",
                 persist_directory: str = "./chroma_db"):
        """
        Initialize the FormFillerRAG system.
        
        Args:
            model_name: Name of the Ollama model to use
            embedding_model: HuggingFace model ID for embeddings
            persist_directory: Directory to persist vector database
        """
        # Initialize the LLM
        self.llm = Ollama(model=model_name)

        # Initialize embeddings (smaller model that runs efficiently on Mac)
        self.embeddings = SentenceTransformerEmbeddings(
            model_name=embedding_model,
            model_kwargs={'device': 'mps'}  # Use Metal Performance Shaders on Mac
        )

        # Initialize vector store
        self.persist_directory = persist_directory
        if os.path.exists(persist_directory):
            self.vectorstore = Chroma(
                persist_directory=persist_directory,
                embedding_function=self.embeddings
            )
        else:
            self.vectorstore = None

        # Initialize text splitter for document processing
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )

        # Track user namespaces to isolate data
        self.user_namespaces = set()

    def process_document(self, 
                        file_path: str, 
                        user_id: str) -> None:
        """
        Process a document and add it to the vector store.
        
        Args:
            file_path: Path to the document
            user_id: Unique identifier for the user
        """
        # Determine file type and use appropriate loader
        extension = os.path.splitext(file_path)[1].lower()

        try:
            if extension == '.pdf':
                loader = PyPDFLoader(file_path)
            elif extension == '.txt':
                loader = TextLoader(file_path)
            elif extension in ['.csv', '.tsv']:
                loader = CSVLoader(file_path)
            elif extension in ['.doc', '.docx']:
                loader = UnstructuredWordDocumentLoader(file_path)
            elif extension in ['.ppt', '.pptx']:
                loader = UnstructuredPowerPointLoader(file_path)
            elif extension in ['.xls', '.xlsx']:
                loader = UnstructuredExcelLoader(file_path)
            else:
                raise ValueError(f"Unsupported file type: {extension}")

            # Load the document
            documents = loader.load()

            # Split the document into chunks
            splits = self.text_splitter.split_documents(documents)

            # Add user_id metadata to each document
            for split in splits:
                split.metadata['user_id'] = user_id

            # Create or update vectorstore
            if self.vectorstore is None:
                self.vectorstore = Chroma.from_documents(
                    documents=splits,
                    embedding=self.embeddings,
                    persist_directory=self.persist_directory
                )
            else:
                # Add documents to existing vectorstore
                self.vectorstore.add_documents(splits)

            # Add user to namespaces
            self.user_namespaces.add(user_id)

            # Persist the vectorstore
            self.vectorstore.persist()

            return len(splits)

        except Exception as e:
            print(f"Error processing document: {e}")
            raise

    def process_text(self, 
                    text: str, 
                    user_id: str,
                    metadata: Optional[Dict[str, Any]] = None) -> int:
        """
        Process text directly and add it to the vector store.
        
        Args:
            text: Text content to process
            user_id: Unique identifier for the user
            metadata: Additional metadata to store
        
        Returns:
            Number of chunks created
        """
        # Create document from text
        from langchain_core.documents import Document

        # Create base metadata
        if metadata is None:
            metadata = {}

        # Add user_id to metadata
        metadata['user_id'] = user_id

        document = Document(page_content=text, metadata=metadata)

        # Split the document
        splits = self.text_splitter.split_documents([document])

        # Create or update vectorstore
        if self.vectorstore is None:
            self.vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=self.embeddings,
                persist_directory=self.persist_directory
            )
        else:
            # Add documents to existing vectorstore
            self.vectorstore.add_documents(splits)

        # Add user to namespaces
        self.user_namespaces.add(user_id)

        # Persist the vectorstore
        self.vectorstore.persist()

        return len(splits)

    def answer_form_question(self, 
                            question: str, 
                            user_id: str,
                            form_context: Optional[str] = None,
                            confidence_threshold: float = 0.7) -> Dict[str, Any]:
        """
        Answer a form question based on the user's data.
        
        Args:
            question: The form question to answer
            user_id: Unique identifier for the user
            form_context: Additional context about the form
            confidence_threshold: Minimum confidence score to provide an answer
            
        Returns:
            Dictionary with answer and confidence score
        """
        if self.vectorstore is None:
            return {
                "answer": None,
                "confidence": 0.0,
                "warning": "No data has been processed yet."
            }

        # Create filter to only retrieve this user's documents
        search_filter = {"user_id": user_id}

        # Create prompt template
        prompt_template = """You are a helpful AI assistant that fills out forms based on user data. 
        Answer the form question using ONLY the provided context. If the context doesn't contain
        the necessary information, DO NOT make up an answer. Instead, respond with "INSUFFICIENT_DATA".

        Be concise and direct in your answers. Format appropriately for the form context.

        Context:
        {context}

        Question: {question}
        
        Form Context: {form_context}

        Your Answer:"""

        PROMPT = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question", "form_context"]
        )

        # Create retrieval chain
        # Get total document count for this user
        try:
            # Count documents for this user (varies by Chroma version)
            doc_count = len(self.vectorstore.get(filter=search_filter)["documents"])
        except:
            # Fallback method if the above doesn't work
            try:
                doc_count = self.vectorstore._collection.count(search_filter)
            except:
                # If all else fails, assume we have at least one document
                doc_count = 1
        
        # Set k to the minimum of 5 or the available documents
        k = min(5, max(1, doc_count))
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.vectorstore.as_retriever(
                search_kwargs={"k": k, "filter": search_filter}
            ),
            return_source_documents=True,
            chain_type_kwargs={"prompt": PROMPT}
        )

        # Get answer - use invoke instead of __call__ to avoid the deprecation warning
        response = qa_chain.invoke({
            "question": question,  # Changed from query to question to match prompt template
            "form_context": form_context or ""
        })

        answer = response['result'].strip()

        # Check for insufficient data
        if "INSUFFICIENT_DATA" in answer:
            return {
                "answer": None,
                "confidence": 0.0,
                "warning": "Insufficient information to answer this question."
            }

        # Evaluate confidence based on retrieval and answer quality
        # This is a simple heuristic - you can replace with a more sophisticated confidence estimator
        confidence = 0.0

        if len(response['source_documents']) > 0:
            # Use a simpler method to calculate confidence - just based on document count
            # Documents are already sorted by relevance by the retriever
            doc_count = len(response['source_documents'])
            confidence = min(0.5 + (doc_count * 0.1), 1.0)  # Base confidence of 0.5, +0.1 per document

        # If confidence is below threshold, warn the user
        if confidence < confidence_threshold:
            return {
                "answer": answer,
                "confidence": confidence,
                "warning": "Low confidence in this answer. Please verify."
            }

        return {
            "answer": answer,
            "confidence": confidence,
            "warning": None
        }

    def clear_user_data(self, user_id: str) -> bool:
        """
        Clear all data for a specific user.
        
        Args:
            user_id: Unique identifier for the user
            
        Returns:
            Success status
        """
        if self.vectorstore is None:
            return True

        try:
            # Delete all documents with this user_id
            self.vectorstore.delete(filter={"user_id": user_id})

            # Remove user from namespaces
            if user_id in self.user_namespaces:
                self.user_namespaces.remove(user_id)

            # Persist changes
            self.vectorstore.persist()

            return True
        except Exception as e:
            print(f"Error clearing user data: {e}")
            return False
