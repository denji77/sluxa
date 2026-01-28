# Slusha Web App 🤖✨

A modern, immersive web-based character AI chat application. Chat with AI-powered characters in real-time using Google's Gemini API, featuring distinct roleplay and casual chat modes, persistent history, and a beautiful glassmorphism UI.

![Slusha Web App Banner](https://via.placeholder.com/1200x400?text=Slusha+Web+App+Preview)

## ✨ Key Features

- **🧠 Dual Chat Modes**:
  - **📖 Descriptive (RP)**: Full roleplay experience with detailed actions, scene descriptions, and emotional context.
  - **💬 Normal (Chat)**: Casual, text-message style conversation where the character speaks naturally without narration.
- **👤 User Profiles**: Set your display name which is automatically injected into chats using `{{user}}` placeholders.
- **🎭 Character System**:
  - Create custom characters with detailed personality definitions.
  - Support for `{{char}}` and `{{user}}` placeholder replacement.
  - **Chub.ai Integration**: Import characters directly from Chub.ai (implementation ready).
- **🔐 Secure Authentication**: Powered by [Clerk](https://clerk.com) for seamless sign-up and sign-in.
- **💾 Persistent History**: All your conversations are saved automatically.
- **🎨 Modern UI/UX**:
  - Responsive design built with React & Tailwind CSS.
  - Glassmorphism aesthetic with smooth Framer Motion animations.
  - Mobile-friendly interface.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Auth**: Clerk React SDK
- **HTTP Client**: Axios

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLAlchemy (SQLite for dev / PostgreSQL ready)
- **AI Engine**: Google Generative AI (Gemini Pro)
- **Validation**: Pydantic
- **Auth Middleware**: Clerk Backend SDK

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **Clerk Account** (for authentication keys)
- **Google AI Studio Key** (for Gemini API)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/slusha-webapp.git
cd slusha-webapp
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

**Configure `backend/.env`:**
```env
GOOGLE_API_KEY=your_gemini_api_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
DATABASE_URL=sqlite:///./slusha.db
```

**Run the Backend:**
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
Open a new terminal:
```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

**Configure `frontend/.env`:**
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
VITE_API_URL=http://localhost:8000
```

**Run the Frontend:**
```bash
npm run dev
```

Visit `http://localhost:5173` (or the port shown in terminal) to start chatting!

## 📂 Project Structure

```
slusha-webapp/
├── backend/                # FastAPI Backend
│   ├── app/
│   │   ├── ai/             # AI Logic (Gemini, Prompts)
│   │   ├── chub/           # Chub.ai Integration
│   │   ├── routers/        # API Endpoints (Chat, Users, Characters)
│   │   ├── models.py       # Database Models
│   │   └── main.py         # App Entry Point
│   └── requirements.txt
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── api/            # API Client
│   │   ├── components/     # UI Components (Chat, Input, Modals)
│   │   ├── contexts/       # Theme & State Contexts
│   │   ├── pages/          # Route Pages (Home, Chat, Profile)
│   │   └── App.jsx
│   └── tailwind.config.js
└── README.md
```

## 🎮 Usage Guide

1. **Sign Up/Login**: Create an account using Clerk.
2. **Set Profile**: Go to Profile settings to set your display name.
3. **Create Character**: Click "New Character" to define a persona (Name, Description, Avatar).
4. **Start Chatting**:
   - Select a character to open the chat.
   - Toggle between **RP** (Book icon) and **Chat** (Bubble icon) modes using the button in the input bar.
   - **RP Mode**: Expect detailed descriptions and actions.
   - **Chat Mode**: Expect quick, direct dialogue.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
