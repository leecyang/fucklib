"""
Vercel Serverless Function Entry Point for FastAPI
This file acts as a bridge between Vercel's serverless function runtime and our FastAPI app.
"""
import sys
import os

# Add the parent directory to Python path to import from backend
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Import the FastAPI app from backend
from backend.main import app

# Vercel will automatically detect and use the 'app' variable
# No need for additional handler when using @vercel/python with FastAPI

