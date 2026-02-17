# Sluxa Web App 🤖✨

A modern, immersive character AI chat platform. Experience deep roleplay and casual conversations with AI characters that remember you, powered by Google Gemini and a sophisticated memory system.

![Sluxa Web App Banner](https://via.placeholder.com/1200x400?text=Sluxa+Web+App+Preview)

## ✨ Core Features

### 🧠 Advanced AI & Memory
*   **Intelligent Engine**: Powered by **Google Gemini 2.5 Flash Lite** for high-quality, cost-effective responses.
*   **RAG Memory System**: 
    *   Uses **Pinecone** vector database with Gemini `embedding-001` to remember long-past conversations.
    *   **Context Injection**: Semantically relevant memories are invisibly retrieved and fed to the AI.
*   **Memory Inspector 🧠**: A "Brain Surgery" tool allowing users to:
    *   View exactly what the AI has stored in long-term memory.
    *   Delete specific hallucinations or unwanted memories.
    *   Wipe the slate clean for a fresh start.
*   **Lorebooks (World Info) 📚**: 
    *   Define keyword-triggered encyclopedias for your characters.
    *   Example: Mention "The Capital" and the AI automatically knows its history and layout.

### 🎭 Character Ecosystem
*   **Dual Chat Modes**:
    *   **📖 Descriptive (RP)**: Full novel-style roleplay with detailed actions, emotions (`*smiles*`), and scene descriptions.
    *   **💬 Normal (Chat)**: Filtered "text-message" style that strips narration for casual banter.
*   **Character Creator**: Define custom personas with Names, Descriptions (System Prompts), Greetings, and Avatars.
*   **Chub.ai Integration**: Built-in search and 1-click import from the massive Chub.ai character repository.
*   **Dynamic Placeholders**: Real-time replacement of `{{user}}` and `{{char}}` tags.

### 💻 Modern Experience
*   **Glassmorphism UI**: A beautiful, translucent interface built with **React**, **Tailwind CSS**, and **Framer Motion**.
*   **Smart Titling**: Auto-generates 3-5 word summaries for new chat sessions.
*   **Optimistic UI**: Zero-latency feel when sending messages.
*   **Secure Auth**: Powered by **Clerk** for seamless Google/GitHub/Email sign-in.
*   **Mobile Ready**: Fully responsive design for roleplay on the go.

## 🛠️ Tech Stack

### Backend (`/backend`)
*   **Framework**: FastAPI (Python 3.12+)
*   **AI**: `google-genai` (Gemini SDK)
*   **Database**: SQLAlchemy (SQLite)
*   **Vector Store**: Pinecone
*   **API Standard**: RESTful architecture

### Frontend (`/frontend`)
*   **Framework**: React 18 + Vite
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **State**: Local React State + Axios Interceptors

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   Google Gemini API Key
*   Pinecone API Key & Index
*   Clerk.com Account (Publishable Key)

### 1. Installation

**Backend:**
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 2. Configuration
Rename `.env.example` in both folders to `.env` and fill in your keys:
*   `GOOGLE_API_KEY`: Your Google Gemini API key.
*   `AI_MODEL`: `gemini-2.5-flash-lite` (default).
*   `PINECONE_API_KEY`: Your Pinecone API key.
*   `PINECONE_INDEX_NAME`: Your Pinecone index name (default: `sluxa`).
*   `VITE_CLERK_PUBLISHABLE_KEY`: From your Clerk dashboard.

## 🗺️ Roadmap & Future Plans

### 🎙️ Voice Integration (v2.0)
*   **Kani-TTS-2 Model**: Character voice synthesis for AI responses.
    *   Each character will have a unique voice profile (pitch, speed, accent).
    *   Select voices will be manually configured initially for featured characters.
    *   Planned Features:
        *   🔊 Play button on AI message bubbles to hear the character speak.
        *   🎚️ Voice customization in character creation (voice model selection).
        *   📥 Audio caching for faster playback of repeated phrases.
*   **Planned Implementation**: Q2 2026

### 🔮 Other Planned Features
*   **Group Chats**: Multi-character conversations in a single chat room.
*   **Image Generation**: AI-powered character art using Stable Diffusion.
*   **Export/Import**: Save and share character cards in JSON format.
*   **Advanced Memory Controls**: Tag-based memory organization and selective wipe.

## 🤝 Contributing
1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
