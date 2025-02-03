"use client";
import Link from "next/link";
import { Home, MessageSquare, Music, Video } from "lucide-react";

export default function Sidebar() {
  const routes = [
    {
      label: "Home",
      icon: Home,
      href: "/",
      color: "text-sky-500",
    },
    {
      label: "Generate with AI",
      icon: MessageSquare,
      href: "/generateWithAI",
      color: "text-violet-500",
    },
    {
      label: "Music Video Generator",
      icon: Music,
      href: "/musicVideoGenerator",
      color: "text-pink-700",
    },
    {
      label: "Generate with Kling",
      icon: Video,
      href: "/generateWithKling",
      color: "text-green-500",
    },
  ];

  return (
    <div className="sidebar">
      <div className="logo">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <h1>VideoVerse</h1>
        </Link>
      </div>
      <nav className="flex flex-col gap-2 border-t border-b border-gray-300 pt-2 pb-2">
        <Link href="/musicVideoGenerator" className="nav-link">
          Generate Video
        </Link>
        <Link href="/my-creations" className="nav-link">
          My Creations
        </Link>
        <Link href="/generateWithAI" className="nav-link">
          Edit with AI
        </Link>
        <Link
          href={`/videoEditor?videoUrl=${encodeURIComponent(
            "/output/final_video.mp4"
          )}`}
          className="nav-link"
        >
          Video Editor
        </Link>
      </nav>

      <div className="profile-section">
        <p>Haseebzaki13</p>
        <p>haseebzaki13@gmail.com</p>
      </div>

      <style jsx>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 250px;
          height: 100vh;
          background-color: #121212;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 20px;
        }
        .logo h1 {
          font-size: 1.5rem;
          margin-bottom: 20px;
        }
        nav {
          flex-grow: 1;
        }
        .nav-link {
          display: block;
          padding: 10px 0;
          color: white;
          text-decoration: none;
        }
        .nav-link:hover {
          color: #4a90e2;
        }
        .upgrade-section {
          background: #0f172a;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
        }
        .upgrade-section h3 {
          font-size: 1rem;
          margin-bottom: 10px;
        }
        .upgrade-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          text-align: left;
        }
        .upgrade-section ul li {
          margin: 5px 0;
          font-size: 0.9rem;
        }
        .upgrade-button {
          margin-top: 10px;
          padding: 10px;
          width: 100%;
          background-color: #4a90e2;
          border: none;
          border-radius: 5px;
          color: white;
          cursor: pointer;
        }
        .profile-section {
          text-align: center;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
