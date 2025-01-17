"use client"
import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="logo">
        <h1>Shorts.lol</h1>
      </div>
      <nav>
        <Link href="/musicVideoGenerator" className="nav-link">
          Generate Video
        </Link>
        <Link href="/my-creations" className="nav-link">
          My Creations
        </Link>
      </nav>
      <div className="upgrade-section">
        <h3>Unlock more features — go Pro!</h3>
        <ul>
          <li>All languages support</li>
          <li>More voice options</li>
          <li>Custom prompts, images</li>
          <li>Subtitle customization</li>
        </ul>
        <button className="upgrade-button">Upgrade</button>
      </div>
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
          background-color: #15202b;
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
          background: #1c2230;
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
