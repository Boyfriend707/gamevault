import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import { auth } from "../api";

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const fn = isRegister ? auth.register : auth.login;
      const { token, user } = await fn(username, password);
      onLogin(token, user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <Gamepad2 size={40} className="brand-icon" />
          <h1>GameVault</h1>
          <p className="login-subtitle">Your gaming dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              minLength={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p className="login-toggle">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button className="link-btn" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? "Sign In" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
