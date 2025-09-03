# Real-Time Chat Application

## Overview

This is a real-time chat application built with Flask and Socket.IO. The application enables multiple users to connect and exchange messages instantly through WebSocket connections. It features a simple web interface where users can set their username and participate in a shared chat room. The application maintains a message history of the last 100 messages and automatically sends this history to newly connected users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Flask web framework for HTTP server and routing
- **Real-time Communication**: Flask-SocketIO for WebSocket connections enabling bidirectional communication
- **Message Storage**: In-memory storage using Python lists for message history
- **Message Management**: Automatic cleanup keeping only the last 100 messages to prevent memory overflow

### Frontend Architecture
- **Template Engine**: Jinja2 templates for server-side rendering
- **Real-time Client**: Socket.IO JavaScript client for WebSocket communication
- **UI Components**: Vanilla JavaScript for DOM manipulation and user interactions
- **Styling**: CSS with gradient backgrounds and responsive design

### Data Structure
- **Message Format**: JSON objects containing username, message content, and timestamp
- **User Management**: Client-side username storage without persistent user accounts
- **Message History**: Circular buffer implementation limiting storage to 100 messages

### Security Considerations
- **XSS Prevention**: HTML escaping for user-generated content
- **CORS Configuration**: Wildcard origin policy for development flexibility
- **Input Validation**: Character limits on usernames (20 chars) and messages (500 chars)

## External Dependencies

### Python Packages
- **Flask**: Web framework for HTTP server functionality
- **Flask-SocketIO**: WebSocket integration for real-time communication
- **datetime**: Standard library for timestamp generation

### Frontend Libraries
- **Socket.IO Client**: CDN-hosted version 4.0.1 for WebSocket client functionality

### Development Dependencies
- **Static File Serving**: Flask's built-in static file handler for CSS and JavaScript assets
- **Template Rendering**: Flask's integrated Jinja2 template engine

Note: The application currently uses in-memory storage which means message history is lost when the server restarts. The architecture supports easy migration to persistent storage solutions like databases.