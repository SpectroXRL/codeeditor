import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { LoginForm } from "../auth/LoginForm";
import { SignupForm } from "../auth/SignupForm";
import "./Header.css";

export function Header() {
  const { user, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const handleSignOut = async () => {
    await signOut();
  };

  const openLogin = () => {
    setAuthMode("login");
    setShowAuthModal(true);
  };

  const openSignup = () => {
    setAuthMode("signup");
    setShowAuthModal(true);
  };

  const closeModal = () => {
    setShowAuthModal(false);
  };

  const switchToSignup = () => {
    setAuthMode("signup");
  };

  const switchToLogin = () => {
    setAuthMode("login");
  };

  return (
    <>
      <header className="header">
        <Link to="/" className="header-logo">
          <h1>CodeLearn</h1>
        </Link>

        <nav className="header-nav">
          <Link to="/agentic" className="nav-link nav-link--agentic">
            <span className="nav-icon">🤖</span>
            Prompt Engineering
          </Link>
        </nav>

        <div className="header-auth">
          {loading ? (
            <span className="auth-loading">Loading...</span>
          ) : user ? (
            <div className="user-menu">
              <span className="user-email">{user.email}</span>
              <button className="btn-secondary" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button className="btn-secondary" onClick={openLogin}>
                Log In
              </button>
              <button className="btn-primary" onClick={openSignup}>
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {showAuthModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              ×
            </button>
            {authMode === "login" ? (
              <LoginForm
                onSuccess={closeModal}
                onSwitchToSignup={switchToSignup}
              />
            ) : (
              <SignupForm
                onSuccess={closeModal}
                onSwitchToLogin={switchToLogin}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
